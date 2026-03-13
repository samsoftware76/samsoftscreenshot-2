import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

console.log("[STABILIZER v7.0] Edge Function 'chat' module loaded successfully.");

function getSystemPrompt(mode: string): string {
  if (mode === 'code') return `You are the "Elite Challenge Solver". Provide the COMPLETE WORKING CODE SOLUTION. Detect the language. Format: description, code block, steps, hints, difficulty.`;
  if (mode === 'essay') return `You are the "Elite Essay Assistant". Write original, human-like responses. Avoid AI-typical words. Vary sentence lengths. Natural student tone.`;
  if (mode === 'handwriting') return `You are the "Master OCR Engine". Transcribe all text exactly as it appears. No summaries.`;
  return `You are the "Military-Grade AI Partner". Analyze input and provide professional assistance. Format in clean markdown.`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  console.log(`[DEBUG v7.0] Received ${req.method} request`);

  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!authHeader || !supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error(`Missing required configuration: SECRETS_NOT_LOADED`);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error(`Unauthorized access`);

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      console.log("[DEBUG] Body is empty or not JSON");
    }

    const { action, messages, mode, sessionId, title, cursor, limit = 20 } = body;
    console.log(`[DEBUG v7.0] Action: ${action || 'default-chat'}`);

    // ACTION: PING (With Logic Diagnostic)
    if (action === 'ping') {
      const keys = [
        'GEMINI_API_KEY', 'GEMINI_KEY_2', 'GEMINI_KEY_3', 'GOOGLEAI_API_KEY',
        'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'
      ];
      const report: any = {};
      keys.forEach(k => report[k] = !!Deno.env.get(k));
      
      return new Response(JSON.stringify({ 
        status: 'ok', 
        user: user.id,
        version: '7.0',
        multimodal: true,
        diagnostics: report 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ACTION: GET-SESSIONS
    if (action === 'get-sessions') {
      const { data, error } = await supabase.from('chat_sessions').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ sessions: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ACTION: GET-HISTORY
    if (action === 'get-history') {
      let query = supabase.from('chat_messages').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(limit);
      if (sessionId) query = query.eq('session_id', sessionId);
      if (cursor) query = query.lt('created_at', cursor);
      const { data, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify({ messages: data?.reverse() || [], hasMore: (data?.length || 0) === limit }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ACTION: CREATE-SESSION
    if (action === 'create-session') {
       // Multitenancy logic (Simplified)
      const { data: membership } = await adminClient.from('organization_members').select('organization_id').eq('user_id', user.id).maybeSingle();
      let orgId = membership?.organization_id;
      if (!orgId) {
         const { data: newOrg } = await adminClient.from('organizations').insert({ name: 'Default Space', slug: `org-${user.id.substring(0, 8)}` }).select().maybeSingle();
         orgId = newOrg?.id;
         if (orgId) await adminClient.from('organization_members').insert({ organization_id: orgId, user_id: user.id, role: 'owner' });
      }

      const { data, error } = await adminClient.from('chat_sessions').insert({
        user_id: user.id,
        organization_id: orgId,
        title: title || 'New Chat',
        mode: mode || 'general'
      }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ACTION: DELETE-SESSION
    if (action === 'delete-session') {
      await supabase.from('chat_sessions').delete().eq('id', sessionId).eq('user_id', user.id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ACTION: CHAT
    if (!messages) throw new Error('No message payload provided');
    const apiKeys = [
      Deno.env.get('GEMINI_API_KEY'),
      Deno.env.get('GEMINI_KEY_2'),
      Deno.env.get('GEMINI_KEY_3'),
      Deno.env.get('GOOGLEAI_API_KEY')
    ].filter(Boolean);

    if (apiKeys.length === 0) throw new Error('No API keys configured');

    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'user') {
      adminClient.from('chat_messages').insert({
        user_id: user.id,
        session_id: sessionId,
        role: 'user',
        content: lastMsg.text || lastMsg.content,
        metadata: lastMsg.files ? { files: lastMsg.files } : null
      }).then(({ error }: { error: any }) => error && console.error('[FAIL] Msg Save:', error.message));
    }

    let aiText = '';
    let firstErrorReason = null;

    // Stable Model List with Multimodal capability
    const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash-8b', 'gemini-pro'];
    const endpoints = ['v1beta', 'v1']; 

    for (const [keyIdx, key] of apiKeys.entries()) {
      if (aiText) break;
      for (const endpoint of endpoints) {
        if (aiText) break;
        for (const model of models) {
          try {
            // gemini-pro is text-only usually
            if (model === 'gemini-pro' && lastMsg.files?.length > 0) continue;

            console.log(`[DEBUG v7.0] Multimodal Attempt: ${endpoint} | ${model} | Key #${keyIdx + 1}`);
            
            const systemPrompt = getSystemPrompt(mode || 'general');
            
            const contents = messages.map((m: any, i: number) => {
                let role = (m.role === 'assistant' || m.role === 'model') ? 'model' : 'user';
                let parts: any[] = [];
                
                // 1. Add Text Part
                let text = m.text || m.content || m.parts?.[0]?.text || '';
                if (i === 0 && role === 'user') {
                   text = `[SYSTEM: ${systemPrompt}]\n\nUSER: ${text}`;
                }
                if (text) parts.push({ text });

                // 2. Add File Parts (FOR USER MESSAGES)
                if (role === 'user' && m.files?.length > 0) {
                  m.files.forEach((f: any) => {
                    if (f.data && f.mimeType) {
                      parts.push({
                        inline_data: {
                          mime_type: f.mimeType,
                          data: f.data
                        }
                      });
                    }
                  });
                }

                return { role, parts };
            }).filter((c: any) => c.parts.length > 0);

            const res = await fetch(`https://generativelanguage.googleapis.com/${endpoint}/models/${model}:generateContent?key=${key}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents }),
            });

            if (!res.ok) {
              const errText = await res.text();
              console.error(`[FAIL v7.0] ${model}@${endpoint}:`, errText);
              if (!firstErrorReason) firstErrorReason = { status: res.status, body: errText, model, endpoint, keyIdx };
              if (res.status === 429) break; 
              continue;
            }

            const d = await res.json();
            aiText = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (aiText) break;
          } catch (err: any) {
            if (!firstErrorReason) firstErrorReason = { error: err.message, model, endpoint };
          }
        }
      }
    }

    if (!aiText) throw new Error(`AI Engines exhausted. Primary Diagnosis: ${JSON.stringify(firstErrorReason)}`);

    if (sessionId) {
      adminClient.from('chat_messages').insert({ user_id: user.id, session_id: sessionId, role: 'assistant', content: aiText });
      adminClient.rpc('decrement_credits', { user_id: user.id });
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
