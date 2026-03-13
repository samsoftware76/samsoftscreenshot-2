import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

console.log("[STABILIZER v10.9] Dynamic Discovery Engine Active.");

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
    
    // v10.9: Deduplicate keys for quota efficiency
    const rawKeys = keysToCheck.map(k => Deno.env.get(k)).filter(Boolean);
    const apiKeys = [...new Set(rawKeys)];

    // --- Action: Ping (v10.9) ---
    if (action === 'ping') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        version: '10.9', 
        diagnostics,
        uniqueKeys: apiKeys.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- Action: Discovery (v10.9) ---
    if (action === 'models') {
       const key = apiKeys[0];
       const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
       return new Response(await res.text(), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- Action: Get Sessions/History/Delete ---
    if (action === 'get-sessions') {
      const { data: sessions, error } = await adminClient.from('chat_sessions').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ sessions }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get-history') {
      let query = adminClient.from('chat_messages').select('*').eq('user_id', user.id).eq('session_id', sessionId).order('created_at', { ascending: false }).limit(limit);
      if (cursor) query = query.lt('created_at', cursor);
      const { data: messages, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify({ messages, hasMore: messages.length === limit }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'delete-session') {
      const { error } = await adminClient.from('chat_sessions').delete().eq('id', sessionId).eq('user_id', user.id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- Action: Chat (AI Logic) ---
    // v10.9: Aggressive Discovery Models
    const modelsToTry = [
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash-001',
      'gemini-1.5-flash-002',
      'gemini-1.5-flash-8b',
      'gemini-1.5-flash-8b-latest',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite-preview-02-05',
      'gemini-1.5-pro',
      'gemini-pro',
      'models/gemini-1.5-flash', // Some projects require the full path
    ];
    
    // v1beta has broader discovery than v1
    const endpoints = ['v1beta', 'v1'];
    let aiText = '';
    const allAttempts: any[] = [];
    const deadKeys = new Set<string>();

    for (const key of apiKeys) {
      if (aiText) break;
      if (deadKeys.has(key)) continue;

      for (const endpoint of endpoints) {
        if (aiText) break;
        for (const modelName of modelsToTry) {
          try {
            // v10.9: Smart prefixing
            const finalModel = modelName.startsWith('models/') ? modelName : `models/${modelName}`;
            
            const payload = {
              contents: messages.map((m: any, i: number) => {
                let role = (m.role === 'assistant' || m.role === 'model') ? 'model' : 'user';
                let text = m.text || m.content || m.parts?.[0]?.text || '';
                if (i === 0 && role === 'user') text = `[INSTRUCTION: Act as Connie AI]\n\nUSER: ${text}`;
                return { role, parts: [{ text }] };
              })
            };

            const url = `https://generativelanguage.googleapis.com/${endpoint}/${finalModel}:generateContent?key=${key}`;
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            const status = res.status;
            const resJson = await res.json().catch(() => ({}));

            if (!res.ok) {
              const errSnippet = JSON.stringify(resJson).substring(0, 150);
              console.error(`[FAIL v10.9] ${finalModel}@${endpoint}: Status ${status}`);
              allAttempts.push({ model: finalModel, endpoint, status, error: errSnippet });
              
              if (status === 429 && JSON.stringify(resJson).includes("limit: 0")) {
                console.warn(`[DEAD KEY] ${key.substring(0,6)}... exhausted. Skipping.`);
                deadKeys.add(key);
                break;
              }
              continue;
            }

            aiText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (aiText) break;
            else allAttempts.push({ model: finalModel, endpoint, status, error: "Empty" });

          } catch (err) {
            allAttempts.push({ model: modelName, endpoint, status: 'EXC', error: err.message });
          }
        }
      }
    }

    if (!aiText) {
      throw new Error(`AI Engines Exhausted. Attempted ${allAttempts.length} variations. Top Fail: ${JSON.stringify(allAttempts[0])}`);
    }

    if (sessionId) {
      await adminClient.from('chat_messages').insert({ user_id: user.id, session_id: sessionId, role: 'assistant', content: aiText, metadata: { engine: 'stabilizer-v10.9' } });
      await adminClient.rpc('decrement_credits', { user_id: user.id });
    }

    return new Response(JSON.stringify({ text: aiText }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
