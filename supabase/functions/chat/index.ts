import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

console.log("[STABILIZER v10.3] Production Multi-Action Engine Active.");

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!authHeader || !supabaseUrl || !supabaseServiceKey) throw new Error("Missing Secrets");

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const body = await req.json().catch(() => ({}));
    const { action, messages, mode, sessionId, cursor, limit = 20 } = body;

    // --- AI Configuration & Diagnostics ---
    const keysToCheck = ['GEMINI_API_KEY', 'GEMINI_KEY_2', 'GEMINI_KEY_3', 'GOOGLEAI_API_KEY'];
    const diagnostics: any = {};
    keysToCheck.forEach(k => { diagnostics[k] = !!Deno.env.get(k); });
    const apiKeys = keysToCheck.map(k => Deno.env.get(k)).filter(Boolean);

    // --- Action: Ping (v10.3) ---
    if (action === 'ping') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        version: '10.3', 
        diagnostics 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- Action: Get Sessions ---
    if (action === 'get-sessions') {
      const { data: sessions, error } = await adminClient
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify({ sessions }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- Action: Get History ---
    if (action === 'get-history') {
      let query = adminClient
        .from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (cursor) query = query.lt('created_at', cursor);

      const { data: messages, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify({ messages, hasMore: messages.length === limit }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- Action: Delete Session ---
    if (action === 'delete-session') {
      const { error } = await adminClient
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- Action: Chat (AI Logic) ---
    // v10.5 RELIABILITY: Prioritize 1.5-Flash (stable) over 2.0-Flash (strict limits)
    const models = [
      'gemini-1.5-flash', 
      'gemini-1.5-flash-8b', 
      'gemini-2.0-flash', 
      'gemini-pro-latest',
      'gemini-1.5-pro'
    ];
    const endpoints = ['v1beta', 'v1'];
    let aiText = '';
    const allAttempts: any[] = [];

    for (const key of apiKeys) {
      if (aiText) break;
      for (const endpoint of endpoints) {
        if (aiText) break;
        for (const model of models) {
          try {
            const payload = {
              contents: messages.map((m: any, i: number) => {
                let role = (m.role === 'assistant' || m.role === 'model') ? 'model' : 'user';
                let parts: any[] = [];
                let text = m.text || m.content || m.parts?.[0]?.text || '';
                if (i === 0 && role === 'user') text = `[INSTRUCTION: Act as Ask Connie AI]\n\nUSER: ${text}`;
                if (text) parts.push({ text });

                if (role === 'user' && m.files?.length > 0) {
                  m.files.forEach((f: any) => {
                    if (f.data && f.mimeType) {
                       parts.push({ inline_data: { mime_type: f.mimeType, data: f.data } });
                    }
                  });
                }
                return { role, parts };
              })
            };

            const res = await fetch(`https://generativelanguage.googleapis.com/${endpoint}/models/${model}:generateContent?key=${key}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            const status = res.status;
            if (!res.ok) {
              const errTxt = await res.text();
              console.error(`[FAIL v10.5] ${model}@${endpoint}: Status ${status}`);
              allAttempts.push({ model, endpoint, status, error: errTxt.substring(0, 500) });
              continue;
            }

            const d = await res.json();
            aiText = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (aiText) break;
            else allAttempts.push({ model, endpoint, status, error: "No text in response candidates" });

          } catch (err) { 
            allAttempts.push({ model, endpoint, status: 'EXCEPTION', error: err.message });
          }
        }
      }
    }

    if (!aiText) {
      throw new Error(`AI Engines Exhausted (Quota Likely Hit). Attempted ${allAttempts.length} combinations: ${JSON.stringify(allAttempts)}`);
    }

    if (sessionId) {
      await adminClient.from('chat_messages').insert({ 
        user_id: user.id, 
        session_id: sessionId, 
        role: 'assistant', 
        content: aiText,
        metadata: { engine: 'gemini-stabilizer-v10.3' }
      });
      await adminClient.rpc('decrement_credits', { user_id: user.id });
    }

    return new Response(JSON.stringify({ text: aiText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
