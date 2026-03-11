import { GoogleGenAI, Content, Part } from '@google/genai';

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

export type AnalysisMode = 'code' | 'essay' | 'general' | 'handwriting';

export interface MediaFile {
    data: string;
    mimeType: string;
}

export interface MessagePayload {
    role: 'user' | 'model';
    text: string;
    files?: MediaFile[];
    created_at?: string;
}

function getSystemPromptForMode(mode: AnalysisMode): string {
    if (mode === 'code') {
        return `You are "Sam Software Challenge Solver", an elite coding assistant. \nThe user is providing a coding challenge, problem, or screenshot. \nYou must provide a comprehensive, working code solution, explain the steps, and offer helpful context. Always format code using markdown blocks.`;
    }
    if (mode === 'essay') {
        return `You are "Sam Software Challenge Solver", an expert academic assistant. \nWrite an original, thoughtful response to the prompt shown in the files or instructions. \nCRUCIAL ANTI-PLAGIARISM INSTRUCTIONS: Do not use typical AI vocabulary (e.g., "delve," "tapestry"). Write with high burstiness. Vary sentence lengths dramatically. Use a natural, mostly conversational but academic tone. Ensure NO copied text.`;
    }
    if (mode === 'handwriting') {
        return `You are "Sam Software Challenge Solver", an advanced OCR and Transcription engine. \nYour ONLY job is to perfectly and accurately transcribe all handwritten text found in the provided images into digital text. Do NOT summarize. Do NOT answer the questions in the text. Just transcribe exactly what is written, keeping the structure and formatting as close as possible.`;
    }
    // general
    return `You are "Sam Software Challenge Solver", a brilliant and helpful multi-modal assistant. \nAnalyze the uploaded documents, photos, or data, and answer the user's instructions perfectly. \nFormat your responses beautifully in markdown.`;
}

export async function processChatRequest(messages: MessagePayload[], mode: AnalysisMode): Promise<string> {
    try {
        console.log(`💬 Processing chat request in ${mode} mode with ${messages.length} messages.`);

        const contents: Content[] = messages.map(msg => {
            const parts: Part[] = [];

            // Add text part
            if (msg.text) {
                parts.push({ text: msg.text });
            }

            // Add files if present
            if (msg.files && msg.files.length > 0) {
                for (const f of msg.files) {
                    parts.push({
                        inlineData: {
                            data: f.data,
                            mimeType: f.mimeType
                        }
                    });
                }
            }

            return {
                role: msg.role,
                parts: parts
            };
        });

        // Prepend systemic instruction to the first user message
        if (contents.length > 0 && contents[0].role === 'user' && contents[0].parts) {
            const systemPrompt = getSystemPromptForMode(mode);
            // Insert it before the actual user text
            contents[0].parts.unshift({ text: `[SYSTEM INSTRUCTION: ${systemPrompt}]\n\n------\n\nUSER PROMPT: ` });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
        });

        if (!response.text) {
            throw new Error("No text response from Gemini");
        }

        return response.text;
    } catch (error) {
        console.error('❌ Chat Error:', error);
        throw new Error(error instanceof Error ? error.message : 'Chat inference failed');
    }
}
