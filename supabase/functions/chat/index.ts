import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const { messages, mode } = await req.json();
    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const systemPrompt = getSystemPrompt(mode || 'general');

    // Build messages for the AI API
    const aiMessages = messages.map((msg: any) => {
      const content: any[] = [];
      if (msg.text) content.push({ type: 'text', text: msg.text });
      if (msg.files?.length > 0) {
        for (const f of msg.files) {
          content.push({
            type: 'image_url',
            image_url: { url: `data:${f.mimeType};base64,${f.data}` },
          });
        }
      }
      return { role: msg.role === 'model' ? 'assistant' : 'user', content };
    });

    // Prepend system message
    aiMessages.unshift({ role: 'system', content: systemPrompt });

    const response = await fetch('https://lovable.dev/api/v2/chat/completions', {
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

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API error [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
