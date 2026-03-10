import { NextRequest, NextResponse } from 'next/server';
import { processChatRequest, type AnalysisMode, type MessagePayload } from '@/lib/chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AnalyzeRequest {
  messages: MessagePayload[];
  mode: AnalysisMode;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 API /analyze called for chat');

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const body: AnalyzeRequest = await request.json();

    if (!body.messages || body.messages.length === 0) {
      return NextResponse.json({ error: 'Messages payload is required' }, { status: 400 });
    }

    // Process chat
    const responseText = await processChatRequest(body.messages, body.mode || 'general');

    return NextResponse.json({
      success: true,
      text: responseText,
    });
  } catch (error) {
    console.error('Error in /api/analyze:', error);

    // Quick payload size error handling
    if (error instanceof Error && error.message.includes('payload too large')) {
      return NextResponse.json({ error: 'Files too large for API. Please limit size or quantity.' }, { status: 413 });
    }

    return NextResponse.json(
      { error: 'Analysis failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
