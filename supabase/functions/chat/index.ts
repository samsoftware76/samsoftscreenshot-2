import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getSystemPrompt(mode: string): string {
  if (mode === 'code') return `You are "Sam Software Challenge Solver", an elite coding assistant. Provide comprehensive, working code solutions with explanations. Format code using markdown blocks.`;
  if (mode === 'essay') return `You are "Sam Software Challenge Solver", an expert academic assistant. Write original, thoughtful responses. ANTI-PLAGIARISM: Avoid typical AI vocabulary. Use high burstiness. Vary sentence lengths. Natural, conversational but academic tone. No copied text.`;
  if (mode === 'handwriting') return `You are "Sam Software Challenge Solver", an advanced OCR engine. Perfectly transcribe all handwritten text from images into digital text. Do NOT summarize or answer questions. Just transcribe exactly.`;
  return `You are "Sam Software Challenge Solver", a brilliant multi-modal assistant. Analyze uploaded documents, photos, or data and answer perfectly. Format in markdown.`;
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

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured in Supabase Secrets');

    let body: any = {};
    try {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch (e) {
      console.warn('Could not parse JSON body:', e);
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || body.action;
    const { messages: clientMessages, mode, cursor, limit = 20 } = body;

    // 3. Organization Provisioning (No Shortcuts Multitenancy)
    let { data: membership, error: memberError } = await serviceRoleClient
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      const { data: newOrg, error: orgError } = await serviceRoleClient.from('organizations').insert({
        name: `${user.email?.split('@')[0]}'s Workspace`,
        slug: `org-${user.id.substring(0, 8)}-${Math.random().toString(36).substring(2, 5)}`
      }).select().single();
      if (orgError || !newOrg) throw new Error(`Failed to create organization: ${orgError?.message}`);

      await serviceRoleClient.from('organization_members').insert({
        organization_id: newOrg.id,
        user_id: user.id,
        role: 'owner'
      });
      membership = { organization_id: newOrg.id };
    }
    const organizationId = membership.organization_id;
    console.log(`Action: ${action}, Org: ${organizationId}, User: ${user.id}`);

    // 4. Credit Check (Idempotent: Ensure profile exists)
    const { data: profile, error: profileError } = await serviceRoleClient
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0]
      }, { onConflict: 'id' })
      .select('credits')
      .single();

    if (profileError || !profile) {
      console.error('Profile Upsert/Fetch Error:', profileError);
      throw new Error(`Could not verify credits: ${profileError?.message || 'Unknown error'}`);
    }

    if (profile.credits <= 0) {
      return new Response(JSON.stringify({ error: 'INSUFFICIENT_CREDITS', message: 'You have depleted your credits. Please upgrade to continue.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- CASE 1: Fetch History (Infinite Scroll) ---
    if (action === 'get-history') {
      let query = supabaseClient
        .from('chat_messages')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (cursor) {
        query = query.lt('created_at', cursor);
      }

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({
        messages: data?.reverse() || [],
        hasMore: data?.length === limit
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

    // Persist user message
    if (lastUserMessage && lastUserMessage.role === 'user') {
      await supabaseClient.from('chat_messages').insert({
        user_id: user.id,
        organization_id: organizationId,
        role: 'user',
        content: lastUserMessage.text,
        mode: mode || 'general'
      });
    }

    // Context Window: Fetch more history for 150,000 token window support
    // We'll fetch last 100 messages which fits well within 150k tokens
    const { data: history } = await supabaseClient
      .from('chat_messages')
      .select('role, content')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true })
      .limit(100);

    const contents = (history && history.length > 0)
      ? history.map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))
      : clientMessages.map((m: any) => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.text || m.content || '' }]
      }));

    // Add files to the current message if present
    if (lastUserMessage?.files?.length > 0) {
      const lastPart = contents[contents.length - 1];
      for (const f of lastUserMessage.files) {
        lastPart.parts.push({
          inline_data: { mime_type: f.mimeType, data: f.data }
        });
      }
    }

    // Call Gemini (Latest v1beta for robustness as per senseai)
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        system_instruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { maxOutputTokens: 4096 }
      }),
    });

    if (!geminiRes.ok) throw new Error(`Gemini API error: ${geminiRes.status}`);

    const resData = await geminiRes.json();
    const aiText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!aiText) throw new Error('Gemini returned an empty response');

    // Persist Assistant Response & Decrement Credit
    await serviceRoleClient.from('chat_messages').insert({
      user_id: user.id,
      organization_id: organizationId,
      role: 'assistant',
      content: aiText,
      mode: mode || 'general'
    });

    await serviceRoleClient.rpc('decrement_credits', { user_id: user.id });

    return new Response(JSON.stringify({ text: aiText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Edge Function Error:', msg);
    console.error('Full Error Object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));

    return new Response(JSON.stringify({
      error: msg,
      details: (error as any)?.details || (error as any)?.hint || 'Check Supabase Edge Function logs for stack trace.',
      context: 'chat_function_v2'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
