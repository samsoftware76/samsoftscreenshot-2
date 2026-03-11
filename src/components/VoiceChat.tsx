'use client';

import { useState, useRef } from 'react';

export default function VoiceChat() {
    const [isActive, setIsActive] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const socketRef = useRef<WebSocket | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);

    const startVoiceSession = async () => {
        setIsConnecting(true);
        try {
            const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
            const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.MultimodalLive?key=${API_KEY}`;

            socketRef.current = new WebSocket(url);

            socketRef.current.onopen = () => {
                console.log('Voice link established');
                setIsConnecting(false);
                setIsActive(true);

                const setup = {
                    setup: {
                        model: "models/gemini-2.0-flash-exp",
                        generation_config: {
                            response_modalities: ["audio"]
                        }
                    }
                };
                socketRef.current?.send(JSON.stringify(setup));
            };

            socketRef.current.onerror = (err) => {
                console.error('Voice WebSocket error:', err);
                setIsConnecting(false);
                setIsActive(false);
            };

            socketRef.current.onclose = () => {
                console.log('Voice link closed');
                setIsConnecting(false);
                setIsActive(false);
            };

            mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            console.error('Voice session failed:', err);
            setIsConnecting(false);
            setIsActive(false);
        }
    };

    const stopVoiceSession = () => {
        socketRef.current?.close();
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        setIsActive(false);
    };

    return (
        <div className="fixed bottom-32 right-8 z-40 group">
            <button
                onClick={isActive ? stopVoiceSession : startVoiceSession}
                className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${isActive ? 'bg-red-500 animate-pulse' : 'bg-black dark:bg-white text-white dark:text-black'
                    } border-4 border-white/20`}
            >
                {isConnecting ? (
                    <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : isActive ? (
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" /></svg>
                ) : (
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" /></svg>
                )}
            </button>
            <div className="absolute -top-12 right-0 bg-black/80 backdrop-blur-md px-4 py-2 rounded-xl text-[10px] font-black text-white uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-2xl">
                {isActive ? 'Live Voice Active' : 'Start Voice Sync'}
            </div>
        </div>
    );
}
