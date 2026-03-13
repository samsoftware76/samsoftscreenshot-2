import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

console.log("[STABILIZER v8.0] Hyper-Resilient Engine Loaded.");

function getSystemPrompt(mode: string): string {
  if (mode === 'code') return `You are the "Elite Challenge Solver". Provide COMPLETE WORKING CODE.`;
  if (mode === 'essay') return `You are the "Elite Essay Assistant". Write original human-like content.`;
  if (mode === 'handwriting') return `You are the "Master OCR Engine". Transcribe text exactly.`;
  return `You are the "Military-Grade AI Partner". Analyze input and provide professional assistance.`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!authHeader || !supabaseUrl || !supabaseServiceKey) throw new Error("Missing Core Secrets");

    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const body = await req.json().catch(() => ({}));
    const { action, messages, mode, sessionId } = body;

    // --- Action: Ping (v8.0) ---
    if (action === 'ping') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        version: '8.0', 
        multimodal: true, 
        discovery: true,
        keys: !!Deno.env.get('GEMINI_API_KEY') 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- Action: Chat ---
    if (!messages) throw new Error("No messages");
    const lastMsg = messages[messages.length - 1];

    const apiKeys = [
      Deno.env.get('GEMINI_API_KEY'),
      Deno.env.get('GEMINI_KEY_2'),
      Deno.env.get('GEMINI_KEY_3'),
      Deno.env.get('GOOGLEAI_API_KEY')
    ].filter(Boolean);

    let aiText = '';
    let firstFail: any = null;

    // Absolute broadest model targets
    const modelOptions = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro', 'gemini-1.0-pro'];
    const endpoints = ['v1', 'v1beta'];

    for (const key of apiKeys) {
      if (aiText) break;
      for (const endpoint of endpoints) {
        if (aiText) break;
        for (const modelId of modelOptions) {
          try {
            // Skip text-only engines if images are present
            if (modelId === 'gemini-pro' && lastMsg.files?.length > 0) continue;

            const payload = {
              contents: messages.map((m: any, i: number) => {
                let role = (m.role === 'assistant' || m.role === 'model') ? 'model' : 'user';
                let parts: any[] = [];
                let text = m.text || m.content || m.parts?.[0]?.text || '';
                
                if (i === 0 && role === 'user') {
                  text = `[STRICT-SYSTEM-INSTRUCTION: ${getSystemPrompt(mode)}]\n\nUSER INPUT: ${text}`;
                }
                if (text) parts.push({ text });

                if (role === 'user' && m.files?.length > 0) {
                  m.files.forEach((f: any) => {
                    if (f.data && f.mimeType) {
                      parts.push({ inline_data: { mime_type: f.mimeType, data: f.data } });
                    }
                  });
                }
                return { role, parts };
              }).filter((c: any) => c.parts.length > 0)
            };

            const url = `https://generativelanguage.googleapis.com/${endpoint}/models/${modelId}:generateContent?key=${key}`;
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            if (!res.ok) {
              const errTxt = await res.text();
              console.error(`[FAIL v8.0] ${modelId}@${endpoint}:`, errTxt);
              if (!firstFail) firstFail = { status: res.status, body: errTxt, model: modelId, endpoint };
              continue;
            }

            const data = await res.json();
            aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (aiText) break;
          } catch (err: any) {
            if (!firstFail) firstFail = { error: err.message };
          }
        }
      }
    }

    if (!aiText) {
       throw new Error(`AI Engines Exhausted. [v8.0 DIAGNOSIS]: ${JSON.stringify(firstFail)}`);
    }

    if (sessionId) {
      await adminClient.from('chat_messages').insert({
        user_id: user.id,
        session_id: sessionId,
        role: 'assistant',
        content: aiText
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
