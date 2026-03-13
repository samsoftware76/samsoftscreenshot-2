'use client';

import { useState, useRef, useEffect } from 'react';

interface VoiceRecorderProps {
    onTranscription: (text: string) => void;
    onError: (error: string) => void;
}

export default function VoiceRecorder({ onTranscription, onError }: VoiceRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                onTranscription(transcript);
                setIsProcessing(false);
            };

            recognitionRef.current.onerror = (event: any) => {
                onError(event.error);
                setIsRecording(false);
                setIsProcessing(false);
            };

            recognitionRef.current.onend = () => {
                setIsRecording(false);
                // Fallback: If we stopped recording but didn't get a result, reset processing
                setTimeout(() => {
                    setIsProcessing(false);
                }, 1000);
            };
        }
    }, [onTranscription, onError]);

    const startRecording = () => {
        if (!recognitionRef.current) {
            onError('Speech recognition not supported in this browser.');
            return;
        }
        setIsRecording(true);
        setIsProcessing(false);
        recognitionRef.current.start();
    };

    const stopRecording = () => {
        if (recognitionRef.current && isRecording) {
            recognitionRef.current.stop();
            setIsRecording(false);
            setIsProcessing(true); // Show processing while finalizing
        }
    };

    return (
        <div className="relative group shrink-0 flex items-center justify-center">
            <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                    isRecording 
                    ? 'bg-red-500 text-white animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]' 
                    : isProcessing
                    ? 'bg-[#1a1a2e] text-[#4f8ef7] cursor-wait'
                    : 'text-[#555577] hover:text-[#4f8ef7] hover:bg-[#4f8ef7]/10'
                }`}
            >
                {isProcessing ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : isRecording ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                ) : (
                    <svg width={20} height={20} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                )}
            </button>
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#0c0c18] border border-[#1e1e35] px-3 py-1.5 rounded-xl text-[9px] font-black text-white uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-2xl z-50">
                {isRecording ? 'Stop Recording' : isProcessing ? 'Processing...' : 'Voice to Text'}
            </div>
        </div>
    );
}
