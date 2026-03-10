import { NextRequest, NextResponse } from 'next/server';
import { analyzeChallenge, analyzeEssayChallenge, type AnalysisMode } from '@/lib/gemini';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AnalyzeRequest {
  image?: string; // base64 encoded image
  mediaType?: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  mode?: AnalysisMode;
  instructions?: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 API /analyze called');
    console.log('🔑 API Key configured:', !!process.env.GEMINI_API_KEY);

    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error: 'API key not configured',
          message: 'GEMINI_API_KEY environment variable is missing',
        },
        { status: 500 }
      );
    }

    // Parse request body
    const body: AnalyzeRequest = await request.json();

    // Validate request
    if (!body.image && !body.instructions) {
      return NextResponse.json(
        { error: 'Missing required fields: please provide an image or instructions' },
        { status: 400 }
      );
    }

    // Validate image data if present
    if (body.image && body.mediaType) {
      const validMediaTypes = [
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
      ];
      if (!validMediaTypes.includes(body.mediaType)) {
        return NextResponse.json(
          {
            error: 'Invalid media type',
            message: `Media type must be one of: ${validMediaTypes.join(', ')}`,
          },
          { status: 400 }
        );
      }

      try {
        // Check if it's valid base64
        const decoded = Buffer.from(body.image, 'base64');
        if (decoded.length === 0) {
          throw new Error('Empty image data');
        }

        // Check size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (decoded.length > maxSize) {
          return NextResponse.json(
            {
              error: 'Image too large',
              message: `Image size exceeds maximum of ${maxSize / 1024 / 1024}MB`,
            },
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: 'Invalid base64 image data' },
          { status: 400 }
        );
      }
    }

    // Analyze the screenshot
    console.log(`📸 Starting image analysis in ${body.mode || 'code'} mode...`);
    const analysis = body.mode === 'essay'
      ? await analyzeEssayChallenge(body.image, body.mediaType, body.instructions)
      : await analyzeChallenge(body.image, body.mediaType, body.instructions);
    console.log('✅ Analysis completed successfully');

    // Return the analysis
    return NextResponse.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('Error in /api/analyze:', error);

    // Handle specific errors
    if (error instanceof Error) {
      // Gemini API errors
      if (error.message.includes('API key')) {
        return NextResponse.json(
          {
            error: 'API configuration error',
            message: 'Invalid or missing API key',
          },
          { status: 500 }
        );
      }

      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please try again later.',
          },
          { status: 429 }
        );
      }

      // Return the error message
      return NextResponse.json(
        {
          error: 'Analysis failed',
          message: error.message,
        },
        { status: 500 }
      );
    }

    // Generic error
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/analyze
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Challenge analyzer API is running',
    configured: !!process.env.GEMINI_API_KEY,
  });
}
