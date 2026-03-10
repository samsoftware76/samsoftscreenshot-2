import { GoogleGenAI } from '@google/genai';

/**
 * Initialize Gemini client with API key from environment
 */
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

export interface ChallengeAnalysis {
    challenge: string;
    steps: string[];
    hints: string[];
    difficulty: 'easy' | 'medium' | 'hard';
    explanation?: string;
    code?: string; // A megoldás kódja
    language?: string; // Programozási nyelv
    textOutput?: string; // For essay or text-based answers
}

export type AnalysisMode = 'code' | 'essay';

/**
 * Analyze a screenshot to detect and help solve coding challenges
 * @param imageBase64 - Base64 encoded image data
 * @param imageMediaType - MIME type of the image (e.g., 'image/png')
 * @param instructions - Optional user instructions
 * @returns Promise with challenge analysis
 */
export async function analyzeChallenge(
    imageBase64: string | undefined,
    imageMediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | undefined,
    instructions?: string
): Promise<ChallengeAnalysis> {
    try {
        console.log('🔍 Starting challenge analysis...');
        console.log('📝 Model:', 'gemini-2.5-flash');
        console.log('🔑 API Key present:', !!process.env.GEMINI_API_KEY);
        console.log('🔑 API Key prefix:', process.env.GEMINI_API_KEY?.substring(0, 10) + '...');

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                ...(imageBase64 && imageMediaType ? [{
                    inlineData: {
                        data: imageBase64,
                        mimeType: imageMediaType,
                    },
                }] : []),
                `Analyze this coding challenge or programming problem. Please:

1. Identify and describe the challenge/problem shown in the image
2. Provide the COMPLETE WORKING CODE SOLUTION (not just steps!)
3. Detect the programming language from the image
4. Give helpful hints for understanding the solution
5. Estimate the difficulty level (easy, medium, hard)
6. Add any additional explanation if needed

Format your response as JSON with this structure:
{
  "challenge": "description of the challenge",
  "code": "the complete working code solution",
  "language": "javascript|python|java|etc",
  "steps": ["step 1 explanation", "step 2 explanation", ...],
  "hints": ["hint 1", "hint 2", ...],
  "difficulty": "easy|medium|hard",
  "explanation": "optional additional context"
}

Important: 
- The "code" field must contain the COMPLETE, WORKING, COPY-PASTEABLE solution code
- In the "code" field, use \\n for newlines, \\t for tabs (proper JSON escaping)
- Return ONLY valid JSON with properly escaped strings, no markdown formatting or extra text.
- Make sure all string values are properly escaped for JSON (newlines as \\n, quotes as \\", etc.)`,
                ...(instructions ? [`\n\nADDITIONAL USER INSTRUCTIONS/CONTEXT:\n${instructions}`] : []),
            ],
            config: {
                responseMimeType: "application/json",
            }
        });

        const responseText = response.text;
        if (!responseText) {
            throw new Error('No text content in Gemini response');
        }

        console.log('📄 Raw response:', responseText.substring(0, 200));

        // Remove markdown code blocks if present
        const jsonText = responseText
            .replace(/^```json\n?/, '')
            .replace(/\n?```$/, '')
            .trim();

        // Try to parse the JSON
        const analysis: ChallengeAnalysis = JSON.parse(jsonText);

        // Validate response structure
        if (!analysis.challenge || !Array.isArray(analysis.steps) || !Array.isArray(analysis.hints)) {
            throw new Error('Invalid response structure from Gemini');
        }

        console.log('✅ Analysis successful!');
        return analysis;
    } catch (error) {
        console.error('❌ Error analyzing challenge:', error);
        throw new Error(
            error instanceof Error ? error.message : 'Failed to analyze challenge'
        );
    }
}

/**
 * Get a hint for a specific step in the challenge
 * @param challenge - The challenge description
 * @param step - The current step number
 * @returns Promise with hint text
 */
export async function getHintForStep(
    challenge: string,
    step: number
): Promise<string> {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `For this coding challenge: "${challenge}"

I'm stuck on step ${step}. Can you give me a helpful hint without fully solving it?

Return only the hint text, no formatting.`
        });

        if (!response.text) {
            throw new Error('No text content in Gemini response');
        }

        return response.text.trim();
    } catch (error) {
        console.error('Error getting hint:', error);
        throw new Error(
            error instanceof Error ? error.message : 'Failed to get hint'
        );
    }
}

/**
 * Analyze a screenshot specifically for essays/text with anti-plagiarism measures
 */
export async function analyzeEssayChallenge(
    imageBase64: string | undefined,
    imageMediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | undefined,
    instructions?: string
): Promise<ChallengeAnalysis> {
    try {
        console.log('🔍 Starting essay analysis with anti-plagiarism bypass...');

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                ...(imageBase64 && imageMediaType ? [{
                    inlineData: {
                        data: imageBase64,
                        mimeType: imageMediaType,
                    },
                }] : []),
                `Analyze this essay prompt, writing assignment, or short-answer question. 

Write an original, thoughtful response to the prompt.

CRUCIAL ANTI-PLAGIARISM & UNDETECTABLE AI INSTRUCTIONS:
1. DO NOT use typical AI vocabulary (e.g., "delve," "tapestry," "furthermore," "in conclusion," "crucial," "dynamic," "multifaceted").
2. Write with HIGH BURSTINESS and HIGH PERPLEXITY. 
3. Vary sentence lengths dramatically. Mix very short, punchy sentences (3-5 words) with longer, complex, compound sentences.
4. Do not structure paragraphs perfectly. A human writer does not always use a perfect topic sentence followed by exactly three supporting facts.
5. Use a natural, slightly conversational but academic tone, as a real college student would write.
6. Adopt a unique perspective rather than the most obvious, consensus viewpoint.
7. Occasionally use a less common synonym, but keep the overall flow natural.
8. Start sentences in varied ways (don't always start with "The," "This," or "However").
9. Ensure there is NO copied text from the internet. All ideas must be entirely originally phrased.

Format your response as JSON with this structure:
{
  "challenge": "A brief summary of what the essay prompt is asking",
  "textOutput": "Your full, humanized, undetectable essay/response",
  "steps": ["Step 1: Brainstorming angles", "Step 2: Drafting", ...],
  "hints": ["A hint on how the user could personalize this", "Another tip for this topic"],
  "difficulty": "medium"
}

Important: 
- The "textOutput" field must contain the COMPLETE written response, structured with \\n\\n for paragraphs.
- Return ONLY valid JSON with properly escaped strings, no markdown formatting or extra text.`,
                ...(instructions ? [`\n\nADDITIONAL USER INSTRUCTIONS/CONTEXT:\n${instructions}`] : []),
            ],
            config: {
                responseMimeType: "application/json",
            }
        });

        const responseText = response.text;
        if (!responseText) throw new Error('No text content in Gemini response');

        const jsonText = responseText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
        const analysis: ChallengeAnalysis = JSON.parse(jsonText);

        if (!analysis.challenge || !analysis.textOutput) {
            throw new Error('Invalid essay response structure from Gemini');
        }

        return analysis;
    } catch (error) {
        console.error('❌ Error analyzing essay challenge:', error);
        throw new Error(
            error instanceof Error ? error.message : 'Failed to analyze essay challenge'
        );
    }
}

export default ai;
