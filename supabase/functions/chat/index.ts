import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Validate user
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const userId = claimsData.claims.sub as string;

    let body: any = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch (e) {
      console.warn('Could not parse JSON body:', e);
    }

    const action = body.action;
    const { messages: clientMessages, mode, cursor, limit = 20 } = body;

    // --- CASE 1: Fetch History ---
    if (action === 'get-history') {
      let query = supabaseClient
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

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

    // --- CASE 2: Send Message ---
    if (!clientMessages || !Array.isArray(clientMessages) || clientMessages.length === 0) {
      throw new Error('Invalid or empty messages payload');
    }

    const systemPrompt = getSystemPrompt(mode || 'general');
    const lastUserMessage = clientMessages[clientMessages.length - 1];

    // Persist user message
    if (lastUserMessage && lastUserMessage.role === 'user') {
      await supabaseClient.from('chat_messages').insert({
        user_id: userId,
        role: 'user',
        content: lastUserMessage.text || lastUserMessage.content || '',
      });
    }

    // Build messages array for the AI gateway (OpenAI-compatible format)
    const aiMessages: any[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Use the client messages for context
    for (const m of clientMessages) {
      const role = (m.role === 'model' || m.role === 'assistant') ? 'assistant' : 'user';
      const content: any[] = [];

      const textContent = m.text || m.content || '';
      if (textContent) {
        content.push({ type: 'text', text: textContent });
      }

      // Add image attachments if present
      if (m.files && Array.isArray(m.files) && m.files.length > 0) {
        for (const f of m.files) {
          content.push({
            type: 'image_url',
            image_url: {
              url: `data:${f.mimeType};base64,${f.data}`
            }
          });
        }
      }

      aiMessages.push({
        role,
        content: content.length === 1 && content[0].type === 'text' ? textContent : content,
      });
    }

    // Call Lovable AI Gateway
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: aiMessages,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const errText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const resData = await aiResponse.json();
    const aiText = resData.choices?.[0]?.message?.content || '';
    if (!aiText) throw new Error('AI returned an empty response');

    // Persist assistant response
    await supabaseClient.from('chat_messages').insert({
      user_id: userId,
      role: 'assistant',
      content: aiText,
    });

    return new Response(JSON.stringify({ text: aiText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Edge Function Error:', msg);

    return new Response(JSON.stringify({
      error: msg,
      context: 'chat_function'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
