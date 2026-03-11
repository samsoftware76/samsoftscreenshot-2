import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function getSystemPrompt(mode: string): string {
  if (mode === 'code') return `You are the "Elite Challenge Solver". Analyze the coding problem. Provide the COMPLETE WORKING CODE SOLUTION. Detect the language. Format: description, code block, steps, hints, difficulty.`;
  if (mode === 'essay') return `You are the "Elite Essay Assistant". Write original, human-like responses. ANTI-PLAGIARISM: Avoid AI-typical words (delve, tapestry, furthermore). Use high burstiness (varied sentence lengths). Punchy vs. Complex mix. Natural student tone.`;
  if (mode === 'handwriting') return `You are the "Master OCR Engine". Transcribe all handwritten or digital text exactly as it appears. No summaries. No conversation. Just raw text transcription.`;
  return `You are the "Military-Grade AI Partner". Analyze input and provide professional, high-performance assistance. Format in clean markdown with small-caps emphasis on key terms.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // 1. Initialize Supabase Clients
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const serviceRoleClient = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Validate User
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error(`Unauthorized: ${userError?.message || 'User not found'}`);

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLEAI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured in Supabase Secrets');

    let body: any = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch (e) {
      console.warn('Could not parse JSON body:', e);
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || body.action;
    const { messages: clientMessages, mode, sessionId, cursor, limit = 20, title } = body;

    // 3. Organization Provisioning (Robust Multitenancy)
    let organizationId: string | null = null;
    try {
      let { data: membership } = await serviceRoleClient
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership) {
        const { data: newOrg, error: orgError } = await serviceRoleClient.from('organizations').insert({
          name: `${user.email?.split('@')[0]}'s Workspace`,
          slug: `org-${user.id.substring(0, 8)}-${Math.random().toString(36).substring(2, 5)}`
        }).select().single();

        if (newOrg) {
          await serviceRoleClient.from('organization_members').insert({
            organization_id: newOrg.id,
            user_id: user.id,
            role: 'owner'
          });
          membership = { organization_id: newOrg.id };
        }
      }
      organizationId = membership?.organization_id || null;
    } catch (err) {
      console.warn('Organization provisioning skipped (DB Syncing):', err);
    }

    // 4. Credit Check (Non-blocking Resilience)
    try {
      const { data: profile } = await serviceRoleClient
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0]
        }, { onConflict: 'id' })
        .select('credits')
        .single();

      if (profile && profile.credits <= 0 && !user.email?.includes('samsoftware')) {
        return new Response(JSON.stringify({ error: 'INSUFFICIENT_CREDITS', message: 'You have depleted your credits. Please upgrade to continue.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (err) {
      console.warn('Credit check bypassed due to DB latency:', err);
    }

    // --- CASE 0: List/Create Sessions ---
    if (action === 'get-sessions') {
      const { data, error } = await supabaseClient
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ sessions: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'create-session') {
      const { data, error } = await serviceRoleClient
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          organization_id: organizationId,
          title: title || 'New Conversation',
          mode: mode || 'general'
        })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- CASE 1: Fetch History (Infinite Scroll) ---
    if (action === 'get-history') {
      let query = supabaseClient
        .from('chat_messages')
        .select('*')
        .eq('user_id', user.id) // Fallback to user_id if org fails
        .order('created_at', { ascending: false })
        .limit(limit);

      if (sessionId) {
        query = query.eq('session_id', sessionId);
      } else if (organizationId) {
        query = query.eq('organization_id', organizationId);
      } else {
        query = query.eq('user_id', user.id);
      }

      if (cursor) {
        query = query.lt('created_at', cursor);
      }

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({
        messages: data?.reverse() || [],
        hasMore: (data?.length || 0) === limit
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- CASE 2: Send Message (Large Context Window) ---
    if (!clientMessages || !Array.isArray(clientMessages) || clientMessages.length === 0) {
      throw new Error('Invalid or empty messages payload');
    }

    const systemPrompt = getSystemPrompt(mode || 'general');
    const lastUserMessage = clientMessages[clientMessages.length - 1];

    // Persist user message (Non-blocking)
    if (lastUserMessage && (lastUserMessage.role === 'user' || lastUserMessage.role === 'user')) {
      const contentText = lastUserMessage.text || lastUserMessage.content || '';
      supabaseClient.from('chat_messages').insert({
        user_id: user.id,
        organization_id: organizationId,
        session_id: sessionId,
        role: 'user',
        content: contentText,
        mode: mode || 'general'
      }).then(({ error }) => error && console.error('History Error:', error));
    }

    // Construct Messages for Gemini
    const contents = clientMessages.map((m: any) => ({
      role: (m.role === 'assistant' || m.role === 'model') ? 'model' : 'user',
      parts: [{ text: m.text || m.content || '' }]
    }));

    // Add files if present
    if (lastUserMessage?.files && lastUserMessage.files.length > 0) {
      const lastPart = contents[contents.length - 1];
      for (const f of lastUserMessage.files) {
        lastPart.parts.push({
          inline_data: { mime_type: f.mimeType, data: f.data }
        } as any);
      }
    }

    // Call Gemini (The "Magic": 1.5 Flash - Stable Response)
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        system_instruction: { parts: { text: systemPrompt } },
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.7
        }
      }),
    });

    if (geminiRes.status === 429) {
      throw new Error('RATE_LIMIT: Gemini is ultra-busy. Wait 60s.');
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini Error: ${geminiRes.status} ${errText}`);
    }

    const resData = await geminiRes.json();
    const aiText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!aiText) throw new Error('Gemini returned empty response');

    // Persist Assistant Response & Decrement Credit (Non-blocking)
    serviceRoleClient.from('chat_messages').insert({
      user_id: user.id,
      organization_id: organizationId,
      session_id: sessionId,
      role: 'assistant',
      content: aiText,
      mode: mode || 'general'
    }).then(() => {
      serviceRoleClient.rpc('decrement_credits', { user_id: user.id });
    });

    return new Response(JSON.stringify({ text: aiText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Edge Function Error:', msg);

    return new Response(JSON.stringify({
      error: msg,
      details: 'Check logs for trace.',
      context: 'chat_function_v2'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
