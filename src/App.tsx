import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ScreenshotCapture from '@/components/ScreenshotCapture';
import WebcamCapture from '@/components/WebcamCapture';
import type { AnalysisMode, MediaFile, MessagePayload } from '@/lib/chat';
import { downloadAsTxt, downloadAsPdf, downloadAsDocx, downloadAsCsv, downloadAsExcel } from '@/lib/export';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';
import AuthUI from '@/components/Auth';
import PaymentUI from '@/components/PaymentUI';
import AdminDashboard from '@/components/AdminDashboard';
import SolutionSteps from '@/components/SolutionSteps';
import VoiceRecorder from '@/components/VoiceRecorder';

interface LocalMessagePayload {
    role: 'user' | 'model';
    text: string;
    created_at?: string;
    files?: { mimeType: string; data: string; preview?: string }[];
}

interface Attachment {
    data: string;
    mimeType: string;
    preview: string;
}


const MessageActions = ({ text }: { text: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    const btnClass = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white border border-transparent hover:border-black/5 dark:hover:border-white/5";

    return (
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-black/5 dark:border-white/5">
            <button onClick={handleCopy} className={btnClass}>
                {copied ? (
                    <>
                        <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        <span>Copied</span>
                    </>
                ) : (
                    <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                        <span>Copy</span>
                    </>
                )}
            </button>

            <div className="h-4 w-px bg-black/5 dark:bg-white/5 mx-1" />

            <button onClick={() => downloadAsTxt(text, 'software-challenge-solve')} className={btnClass}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span>TXT</span>
            </button>

            <button onClick={() => downloadAsPdf(text, 'software-challenge-solve')} className={btnClass}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                <span>PDF</span>
            </button>

            <button onClick={() => downloadAsDocx(text, 'software-challenge-solve')} className={btnClass}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span>DOCX</span>
            </button>

            <button onClick={() => downloadAsCsv(text, 'software-challenge-solve')} className={btnClass}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                <span>CSV</span>
            </button>

            <button onClick={() => downloadAsExcel(text, 'software-challenge-solve')} className={btnClass}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>XLSX</span>
            </button>
        </div>
    );
};

export default function App() {
    const [messages, setMessages] = useState<LocalMessagePayload[]>([]);
    const [input, setInput] = useState('');
    const [mode, setMode] = useState<AnalysisMode>('general');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [syncRequired, setSyncRequired] = useState(false);
    const [showWelcome, setShowWelcome] = useState(true);
    const [inputTab, setInputTab] = useState<'screenshot' | 'files' | 'paste'>('screenshot');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isOnline, setIsOnline] = useState(true);
    const [session, setSession] = useState<Session | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [showPayment, setShowPayment] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [credits, setCredits] = useState<number | null>(null);
    const [view, setView] = useState<'chat' | 'admin'>('chat');
    const [hasMore, setHasMore] = useState(true);
    const [isOldHistoryLoading, setIsOldHistoryLoading] = useState(false);

    // Multi-Chat State
    const [sessions, setSessions] = useState<any[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [currentSolution, setCurrentSolution] = useState<any>(null);
    const [showVoice, setShowVoice] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const topSentinelRef = useRef<HTMLDivElement>(null);

    // Auth Listener
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setIsAuthLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setIsAuthLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Load Sessions & History
    useEffect(() => {
        if (session) {
            console.log("🔍 [DEBUG] PINGing Edge Function 'chat'...");
            supabase.functions.invoke('chat', { body: { action: 'ping' } })
                .then(({ data, error }) => {
                    if (error) console.error("❌ [DEBUG] PING FAILED:", error);
                    else {
                        console.log("✅ [DEBUG] PING SUCCESS:", data);
                        if (data.diagnostics) {
                            console.table(data.diagnostics);
                            const missing = Object.entries(data.diagnostics).filter(([_, v]) => !v).map(([k]) => k);
                            if (missing.length > 0) {
                                console.warn("⚠️ [DEBUG] MISSING SECRETS:", missing.join(', '));
                            } else {
                                console.log("✨ [DEBUG] ALL SECRETS CONFIGURED!");
                            }
                        }
                    }
                });

            const loadSessions = async () => {
                try {
                    const { data, error } = await supabase.functions.invoke('chat', { body: { action: 'get-sessions' } });
                    if (data?.warning === 'DB_SYNC_REQUIRED' || error) {
                        console.error('❌ [DEBUG] SESSION LOAD FAILED:', data?.warning || error);
                        setSyncRequired(true);
                        return;
                    }
                    if (data?.sessions) {
                        console.log("✅ [DEBUG] SESSIONS LOADED:", data.sessions.length);
                        setSessions(data.sessions);
                        setSyncRequired(false);
                    }
                } catch (err) {
                    console.error('❌ [DEBUG] SESSION LOAD CRASH:', err);
                    setSyncRequired(true);
                }
            };
            const loadProfile = async () => {
                const { data } = await supabase.from('profiles').select('is_admin, credits').eq('id', session.user.id).maybeSingle();
                if (data) {
                    setIsAdmin(!!data.is_admin);
                    setCredits(data.credits);
                }
            };
            loadSessions();
            loadProfile();
        }
    }, [session]);

    const refreshProfile = async () => {
        if (!session) return;
        const { data } = await supabase.from('profiles').select('credits').eq('id', session.user.id).maybeSingle();
        if (data) setCredits(data.credits);
    };

    useEffect(() => {
        if (session && currentSessionId) {
            const loadHistory = async () => {
                setIsLoading(true);
                try {
                    console.log(`🔍 [DEBUG] Loading History for session: ${currentSessionId}`);
                    const { data, error } = await supabase.functions.invoke('chat', {
                        body: { action: 'get-history', sessionId: currentSessionId, limit: 20 }
                    });
                    if (error) throw error;
                    if (data?.messages) {
                        console.log(`✅ [DEBUG] HISTORY LOADED: ${data.messages.length} messages`);
                        const formatted: LocalMessagePayload[] = data.messages.map((m: any) => ({
                            role: m.role === 'assistant' ? 'model' : 'user',
                            text: m.content,
                            created_at: m.created_at,
                            files: m.metadata?.files
                        }));
                        setMessages(formatted);
                        setHasMore(data.hasMore);

                        // If in Solver mode, try to parse the last assistant message as a solution
                        if ((mode === 'code' || mode === 'essay') && formatted.length > 0) {
                            const lastModel = [...formatted].reverse().find(m => m.role === 'model');
                            if (lastModel) parseAndSetSolution(lastModel.text);
                        }
                    }
                } catch (err) {
                    console.error('❌ [DEBUG] HISTORY LOAD FAILED:', err);
                } finally {
                    setIsLoading(false);
                }
            };
            loadHistory();
        }
    }, [session, currentSessionId]);

    const parseAndSetSolution = (text: string) => {
        // Basic parser for the structured markdown from our Edge Function
        try {
            const codeMatch = text.match(/```(?:\w+)?\n([\s\S]*?)```/);
            const steps = text.match(/Steps:?\n([\s\S]*?)(?:\n\n|\nHints:|$)/i)?.[1].split('\n').filter(s => s.trim()) || [];
            const hints = text.match(/Hints:?\n([\s\S]*?)(?:\n\n|$)/i)?.[1].split('\n').filter(s => s.trim()) || [];

            setCurrentSolution({
                challenge: text.split('\n')[0].substring(0, 200),
                code: codeMatch ? codeMatch[1] : undefined,
                language: text.match(/DETECTED: (\w+)/)?.[1] || 'auto',
                steps: steps.map(s => s.replace(/^\d+\.\s*/, '')),
                hints: hints.map(h => h.replace(/^-?\s*/, '')),
                difficulty: text.toLowerCase().includes('hard') ? 'hard' : text.toLowerCase().includes('medium') ? 'medium' : 'easy',
                textOutput: mode === 'essay' ? text : undefined
            });
        } catch (e) {
            console.warn('Silent solution parse fail:', e);
        }
    };

    // Infinite Scroll Implementation
    const loadMoreMessages = async () => {
        if (!hasMore || isOldHistoryLoading || messages.length === 0) return;

        setIsOldHistoryLoading(true);
        const oldestMessage = messages[0];
        const cursor = (oldestMessage as any).created_at;

        try {
            const { data, error } = await supabase.functions.invoke('chat', {
                body: { action: 'get-history', cursor, limit: 20 }
            });

            if (error) throw error;

            if (data?.messages && data.messages.length > 0) {
                const formatted = data.messages.map((m: any) => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    text: m.content,
                    created_at: m.created_at
                }));

                // Maintain scroll position roughly
                const scrollHeightBefore = scrollContainerRef.current?.scrollHeight || 0;

                setMessages(prev => [...formatted, ...prev]);
                setHasMore(data.hasMore);

                // Wait for render, then adjust scroll
                setTimeout(() => {
                    if (scrollContainerRef.current) {
                        const scrollHeightAfter = scrollContainerRef.current.scrollHeight;
                        scrollContainerRef.current.scrollTop = scrollHeightAfter - scrollHeightBefore;
                    }
                }, 0);
            } else {
                setHasMore(false);
            }
        } catch (err) {
            console.error('Load more error:', err);
        } finally {
            setIsOldHistoryLoading(false);
        }
    };

    // Sentinel Intersection Observer
    useEffect(() => {
        if (!topSentinelRef.current || !hasMore) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    loadMoreMessages();
                }
            },
            { threshold: 1.0, root: scrollContainerRef.current }
        );

        observer.observe(topSentinelRef.current);
        return () => observer.disconnect();
    }, [hasMore, messages, isOldHistoryLoading]);

    // Persistence: Load from localStorage (as fallback or for guests)
    useEffect(() => {
        if (!session) {
            const savedMessages = localStorage.getItem('chat_history');
            const savedMode = localStorage.getItem('chat_mode');
            if (savedMessages) setMessages(JSON.parse(savedMessages));
            if (savedMode) setMode(savedMode as AnalysisMode);
        }
    }, [session]);

    // Persistence: Save to localStorage (guest/redundancy)
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('chat_history', JSON.stringify(messages));
        }
        localStorage.setItem('chat_mode', mode);
    }, [messages, mode]);

    useEffect(() => {
        setIsOnline(window.navigator.onLine);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const resetApp = () => {
        setMessages([]);
        setAttachments([]);
        setInput('');
        setMode('general');
        setError(null);
        setShowWelcome(true);
        setCurrentSessionId(null);
        setCurrentSolution(null);
    };

    const startNewChat = (targetMode: AnalysisMode = 'general') => {
        setCurrentSessionId(null);
        setMessages([]);
        setCurrentSolution(null);
        setMode(targetMode);
        setSidebarOpen(false);
        setShowWelcome(true);
        setError(null);
    };

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom of chat ONLY when sending new message
    useEffect(() => {
        if (!isOldHistoryLoading) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages.length, isOldHistoryLoading]);

    const handleCapture = (data: string) => {
        const base64Data = data.includes('base64,') ? data.split('base64,')[1] : data;
        if (attachments.length >= 10) {
            setError('Maximum 10 files allowed');
            return;
        }
        setAttachments(prev => [...prev, { data: base64Data, mimeType: 'image/png', preview: data }]); // Added preview
        setError(null);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        if (attachments.length + files.length > 10) {
            setError('You can only upload a maximum of 10 files total.');
            return;
        }

        files.forEach(file => {
            if (file.size > 20 * 1024 * 1024) {
                setError(`File ${file.name} is too large. Maximum size is 20MB.`);
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                const base64String = event.target?.result as string;
                const base64Data = base64String.includes('base64,') ? base64String.split('base64,')[1] : base64String;

                let mimeType = 'image/png';
                if (file.type === 'application/pdf') mimeType = 'application/pdf';
                else if (file.type === 'image/jpeg' || file.type === 'image/jpg') mimeType = 'image/jpeg';
                else if (file.type === 'image/webp') mimeType = 'image/webp';
                else if (file.type === 'image/gif') mimeType = 'image/gif';

                setAttachments(prev => [...prev, { data: base64Data, mimeType, preview: base64String }]); // Added preview
            };
            reader.readAsDataURL(file);
        });

        e.target.value = '';
        setError(null);
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSend = async () => {
        if ((!input.trim() && attachments.length === 0) || isLoading) return;

        // Auto-create session if none active
        let activeSessionId = currentSessionId;
        if (!activeSessionId) {
            setIsLoading(true);
            try {
                const { data } = await supabase.functions.invoke('chat', {
                    body: { action: 'create-session', mode, title: input.substring(0, 30) || 'New Chat' }
                });
                if (data?.id) {
                    activeSessionId = data.id;
                    setCurrentSessionId(data.id);
                    setSessions(prev => [data, ...prev]);
                }
            } catch (e) {
                console.error('Session auto-create failed:', e);
            }
        }

        const userMessage: LocalMessagePayload = {
            role: 'user',
            text: input.trim(),
            files: attachments.length > 0 ? [...attachments] : undefined
        };

        const newHistory = [...messages, userMessage];
        setMessages(newHistory);
        setInput('');
        setAttachments([]);
        setIsLoading(true);
        setError(null);

        try {
            const { data, error: fnError } = await supabase.functions.invoke('chat', {
                body: { messages: newHistory, mode, sessionId: activeSessionId },
            });

            if (fnError) {
                console.error("❌ [CHAT ERROR] RAW:", fnError);
                // Attempt to parse JSON error if it's a 500
                try {
                   const errBody = await (fnError as any).context?.json();
                   if (errBody) console.error("❌ [CHAT ERROR] DETAILED:", JSON.stringify(errBody, null, 2));
                } catch { /* Ignore if not JSON */ }
                throw fnError;
            }
            if (!data?.text) throw new Error('No response from AI');

            const aiText = data.text;
            setMessages(prev => [...prev, { role: 'model', text: aiText }]);

            // Update sidebar (bump to top)
            setSessions(prev => {
                const existing = prev.find(s => s.id === activeSessionId);
                const others = prev.filter(s => s.id !== activeSessionId);
                if (existing) {
                    return [{ ...existing, created_at: new Date().toISOString() }, ...others];
                }
                return prev;
            });

            if (mode === 'code' || mode === 'essay') {
                parseAndSetSolution(aiText);
            }
            
            // Sync credits after usage
            setTimeout(refreshProfile, 1000);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(message);
            console.error('Chat error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleDeleteSession = async (id: string) => {
        try {
            // Optimistic Update
            setSessions(prev => prev.filter(s => s.id !== id));
            if (currentSessionId === id) {
                setCurrentSessionId(null);
                setMessages([]);
            }
            
            await supabase.functions.invoke('chat', {
                body: { action: 'delete-session', sessionId: id }
            });
        } catch (err) {
            console.error('Delete failed:', err);
            // Revert on failure (optional, but professional)
            const { data } = await supabase.functions.invoke('chat', { body: { action: 'get-sessions' } });
            if (data?.sessions) setSessions(data.sessions);
        }
    };

    const handleNewChat = () => {
        setCurrentSessionId(null);
        setMessages([]);
        setSidebarOpen(false);
        setError(null);
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        resetApp();
    };

    if (isAuthLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-[#FCF1E9] dark:bg-[#0A0A0A]">
                <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center animate-pulse mb-6">
                    <img src="/logo.svg" alt="Logo" className="w-10 h-10" />
                </div>
                <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-black dark:bg-white rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-2 h-2 bg-black dark:bg-white rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-2 h-2 bg-black dark:bg-white rounded-full animate-bounce" />
                </div>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="min-h-screen bg-[#FCF1E9] dark:bg-[#0A0A0A] flex items-center justify-center p-4">
                <AuthUI />
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-[#08080f] text-[#e8e8f8] font-sans selection:bg-[#4f8ef7]/30 selection:text-white overflow-hidden relative">
            {/* Drawer Backdrop Overlay */}
            <div
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setSidebarOpen(false)}
            />

            {/* History Sidebar */}
            <aside className={`fixed inset-y-0 left-0 bg-[#0c0c18] w-72 border-r border-[#1e1e35] shadow-2xl z-50 transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-4 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-6 px-2">
                        <span className="text-[11px] font-black text-[#555577] uppercase tracking-[0.2em]">Sessions</span>
                        <div className="flex gap-1">
                            <button onClick={handleNewChat} className="p-2 text-[#4f8ef7] hover:bg-[#4f8ef7]/10 rounded-lg transition-all" title="New Chat">
                                <svg width={18} height={18} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                            </button>
                            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 text-[#555577] hover:text-[#aaa] transition-colors">
                                <svg width={18} height={18} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                        {syncRequired ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center px-4 bg-amber-500/5 rounded-2xl border border-amber-500/20 m-2">
                                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center mb-3">
                                    <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-500/80 mb-1">Database Sync Required</p>
                                <p className="text-[9px] text-[#555577]">Please run the setup script in your Supabase SQL Editor.</p>
                            </div>
                        ) : sessions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                                <div className="w-12 h-12 rounded-2xl bg-[#12121e] border border-[#1e1e35] flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-[#444466]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-[#555577] mb-1">No Recent Chats</p>
                                <p className="text-[9px] text-[#444466]">Your session history will appear here.</p>
                            </div>
                        ) : (
                            sessions.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => {
                                        setCurrentSessionId(s.id);
                                        setMode(s.mode || 'general');
                                        setSidebarOpen(false);
                                    }}
                                    className={`w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 group ${currentSessionId === s.id
                                        ? 'bg-[#1a1a30] border border-[#2a2a45] text-[#c0c0f0]'
                                        : 'border border-transparent hover:bg-[#141426] text-[#888] hover:text-[#c0c0f0]'
                                        }`}
                                >
                                    <span className="text-base shrink-0">
                                        {s.mode === 'code' ? '💻' : s.mode === 'essay' ? '📝' : s.mode === 'handwriting' ? '✍️' : '💬'}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-semibold truncate">{s.title || 'Untitled Solve'}</div>
                                        <div className="text-[10px] opacity-40 uppercase tracking-tighter mt-0.5">{new Date(s.created_at).toLocaleDateString()}</div>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}
                                        className="p-2 text-[#444466] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all pointer-events-auto"
                                        title="Delete Session"
                                    >
                                        <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </button>
                            ))
                        )}
                    </div>

                    <div className="pt-4 border-t border-[#1e1e35] mt-auto space-y-3">
                        {/* Credits Display */}
                        <div className="bg-[#12121e] border border-[#1e1e35] rounded-2xl p-4 shadow-xl">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black text-[#555577] uppercase tracking-widest">Available Credits</span>
                                <span className="text-xs font-black text-[#4f8ef7]">{(credits || 0).toLocaleString()}</span>
                            </div>
                            <div className="w-full h-1 bg-[#1e1e35] rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-[#4f8ef7] to-[#9f6ef5] transition-all duration-1000"
                                    style={{ width: `${Math.min(100, ((credits || 0) / 1000) * 100)}%` }}
                                />
                            </div>
                            <button 
                                onClick={() => setShowPayment(true)}
                                className="w-full mt-3 py-2 px-4 rounded-xl bg-[#4f8ef7]/10 hover:bg-[#4f8ef7] text-[#4f8ef7] hover:text-white text-[10px] font-black uppercase tracking-widest transition-all border border-[#4f8ef7]/20 hover:border-transparent flex items-center justify-center gap-2"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                Top Up Now
                            </button>
                        </div>

                        <button onClick={handleSignOut} className="w-full p-3 rounded-xl text-left text-red-500/80 hover:bg-red-500/10 hover:text-red-500 transition-all flex items-center gap-3 group">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            <span className="text-[10px] font-black uppercase tracking-widest">Sign Out</span>
                        </button>
                    </div>
                </div>
            </aside>

            <div className="flex flex-col flex-1 min-w-0 h-full">
                {/* Header */}
                <header className="flex-shrink-0 h-14 border-b border-[#1e1e35] bg-[#0e0e1c] flex items-center justify-between px-4 z-30">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className={`p-2 rounded-lg transition-colors ${sidebarOpen ? 'bg-[#1e1e35] text-white' : 'text-[#888] hover:bg-[#1a1a2e]'}`}
                        >
                            <svg width={20} height={20} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#4f8ef7] to-[#9f6ef5] flex items-center justify-center shadow-[0_0_20px_rgba(79,142,247,0.3)]">
                                <img src="/logo.svg" alt="Connie" className="w-6 h-6 invert" />
                            </div>
                            <div className="flex items-center text-sm font-black tracking-tight">
                                <span className="bg-gradient-to-r from-[#4f8ef7] to-[#9f6ef5] bg-clip-text text-transparent">Ask Connie</span>
                                <span className="text-[#e8e8f8] ml-1">Ai</span>
                            </div>
                    </div>

                    <div className="flex items-center text-sm font-black tracking-tight">
                        <span className="bg-gradient-to-r from-[#4f8ef7] to-[#9f6ef5] bg-clip-text text-transparent">Ask Connie</span>
                        <span className="text-[#e8e8f8] ml-1">Ai</span>
                    </div>
                    {/* Desktop Mode Toggle */}
                    <div className="hidden lg:flex items-center bg-[#13131f] rounded-xl p-0.5 border border-[#1e1e35] gap-0.5">
                        {(['general', 'code', 'essay', 'handwriting'] as const).map(m => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${mode === m
                                    ? 'bg-[#4f8ef7] text-white shadow-lg'
                                    : 'text-[#666] hover:text-[#aaa]'
                                    }`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={() => startNewChat(mode)} className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#4f8ef7] hover:bg-[#3a7de6] text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all shadow-lg active:scale-95">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                            New Chat
                        </button>
                        
                        <div className="h-6 w-px bg-[#1e1e35] mx-1"></div>

                        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => isAdmin && setView(view === 'chat' ? 'admin' : 'chat')}>
                             <div className="flex flex-col items-end leading-none">
                                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest group-hover:text-white transition-colors">{session.user.email?.split('@')[0]}</span>
                                {credits !== null && <span className="text-[10px] font-black text-[#4f8ef7] mt-0.5">{credits} Credits</span>}
                             </div>
                             <div className="w-8 h-8 rounded-lg bg-[#1a1a2e] border border-[#2a2a45] flex items-center justify-center group-hover:border-[#4f8ef7] transition-all">
                                <span className="text-[#e8e8f8] text-[10px] font-black uppercase">{session.user.email?.[0] || 'U'}</span>
                             </div>
                        </div>

                        {isAdmin && (
                            <button onClick={() => setView(view === 'chat' ? 'admin' : 'chat')} className="p-2 text-[#888] hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </button>
                        )}

                        <button onClick={() => setShowPayment(true)} className="p-2 text-yellow-500 hover:text-yellow-400 transition-colors">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        </button>
                    </div>
                </header>

                {showPayment && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="relative w-full max-w-md animate-in zoom-in-95 duration-300">
                            <button
                                onClick={() => setShowPayment(false)}
                                className="absolute -top-12 right-0 p-2 text-white hover:text-gray-300 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                            <PaymentUI session={session} />
                        </div>
                    </div>
                )}

                <main className="flex-1 overflow-y-auto px-4 py-8 space-y-8 scroll-smooth custom-scrollbar" ref={scrollContainerRef}>
                    {view === 'admin' ? (
                        <AdminDashboard />
                    ) : currentSolution && (mode === 'code' || mode === 'essay') ? (
                        <div className="max-w-6xl mx-auto h-full flex flex-col gap-6 animate-in slide-in-from-right-4 duration-500">
                             <div className="flex items-center justify-between mb-4">
                                <button
                                    onClick={() => setCurrentSolution(null)}
                                    className="px-4 py-2 bg-[#1a1a2e] border border-[#2a2a45] rounded-xl text-[10px] font-black uppercase tracking-widest text-[#888] hover:text-white transition-all flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                                    Back to Chat
                                </button>
                                <div className="text-[10px] font-black uppercase tracking-widest text-[#4f8ef7]">Solution Analysis Active</div>
                            </div>
                            <div className="flex-1 bg-[#12121e] border border-[#1e1e35] rounded-[2.5rem] overflow-hidden shadow-2xl">
                                <SolutionSteps {...currentSolution} />
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-4xl mx-auto space-y-8">
                            <div ref={topSentinelRef} className="h-4 w-full flex justify-center items-center">
                                {isOldHistoryLoading && (
                                    <div className="flex gap-1 py-4">
                                        <div className="thinking-dot" style={{ animationDelay: '0ms' }} />
                                        <div className="thinking-dot" style={{ animationDelay: '150ms' }} />
                                        <div className="thinking-dot" style={{ animationDelay: '300ms' }} />
                                    </div>
                                )}
                            </div>

                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center gap-6 animate-in fade-in duration-700">
                                    <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-[#4f8ef71a] to-[#9f6ef51a] border border-[#2e2e50] flex items-center justify-center">
                                        <svg width={40} height={40} fill="none" stroke="currentColor" viewBox="0 0 24 24" className="text-[#4f8ef7]">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-[#e0e0f8] mb-2 tracking-tight">Ask Connie Ai Intelligence 🔑</h2>
                                        <p className="text-sm text-[#555577] max-w-sm mx-auto leading-relaxed">
                                            Multi-shot capture, handwriting OCR, and AI modeling combined into one complete intelligence engine.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 w-full max-w-lg mt-4">
                                        {[
                                            ['📸', 'Multi-shot', 'Capture parts 1, 2, 3'],
                                            ['✍️', 'OCR Mode', 'Handwriting to text'],
                                            ['💻', 'Code Solve', 'Step-by-step logic'],
                                            ['📝', 'Essay Auth', 'Humanized assignments'],
                                        ].map(([icon, title, subtitle]) => (
                                            <div key={title} className="bg-[#10101c] border border-[#1e1e30] rounded-2xl p-4 text-left hover:border-[#4f8ef7]/40 transition-colors cursor-pointer" onClick={() => setMode(title.split(' ')[0].toLowerCase() as any)}>
                                                <div className="text-xl mb-1">{icon}</div>
                                                <div className="text-xs font-bold text-[#c0c0e0]">{title}</div>
                                                <div className="text-[10px] text-[#444466] mt-1">{subtitle}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {messages.map((msg, idx) => (
                                        <div key={idx} className={`flex gap-3 mb-8 items-start ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                            <div className="flex flex-col gap-1 min-w-0 max-w-[85%]">
                                                <div className={`flex items-center gap-2 mb-1 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[8px] font-black shadow-sm ${msg.role === 'user' ? 'bg-[#4f8ef7] text-white' : 'bg-gradient-to-br from-[#4f8ef7] to-[#9f6ef5] text-white'}`}>
                                                        {msg.role === 'user' ? 'U' : 'C'}
                                                    </div>
                                                    <span className="text-[9px] font-bold text-[#555577] uppercase tracking-widest">{msg.role === 'user' ? 'You' : 'Ask Connie Ai'}</span>
                                                </div>
                                                <div className={`p-4 rounded-[1.5rem] shadow-sm transition-all duration-300 ${
                                                    msg.role === 'user'
                                                        ? 'bg-[#1a1a2e] border border-[#2a2a45] text-white rounded-tr-none'
                                                        : 'bg-[#12121e] border border-[#1e1e35] text-[#e8e8f8] rounded-tl-none'
                                                }`}>
                                                    {msg.files && msg.files.length > 0 && (
                                                        <div className="flex flex-wrap gap-2 mb-3">
                                                            {msg.files.map((file: any, fIdx: number) => (
                                                                <div key={fIdx} className="w-20 h-20 rounded-xl overflow-hidden shadow-md border border-white/10 bg-black/20 group relative">
                                                                    {file.mimeType === 'application/pdf' ? (
                                                                        <div className="w-full h-full flex flex-col items-center justify-center bg-white/5">
                                                                            <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /></svg>
                                                                            <span className="text-[8px] font-black mt-1 uppercase text-[#888]">PDF</span>
                                                                        </div>
                                                                    ) : (
                                                                        <img src={file.preview} alt="attachment" className="w-full h-full object-cover" />
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <div className={`prose prose-sm prose-invert max-w-none text-sm leading-relaxed ${msg.role === 'user' ? 'text-white' : 'text-[#d8d8f0]'}`}>
                                                        {msg.role === 'model' ? (
                                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                                                        ) : (
                                                            <p className="whitespace-pre-wrap">{msg.text}</p>
                                                        )}
                                                    </div>

                                                    {msg.role === 'model' && <MessageActions text={msg.text} />}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {isLoading && (
                                        <div className="flex gap-3 items-start msg-enter">
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4f8ef7] to-[#9f6ef5] flex items-center justify-center text-[10px] font-black shadow-lg">C</div>
                                            <div className="bg-[#12121e] border border-[#1e1e35] rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-3 shadow-xl">
                                                <div className="flex gap-1.5">
                                                    <div className="thinking-dot" style={{ animationDelay: '0ms' }} />
                                                    <div className="thinking-dot" style={{ animationDelay: '150ms' }} />
                                                    <div className="thinking-dot" style={{ animationDelay: '300ms' }} />
                                                </div>
                                                <span className="text-xs font-semibold text-[#555577]">Connie is thinking...</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </main>

                <footer className="p-4 bg-transparent relative z-20">
                    <div className="max-w-4xl mx-auto">
                        {/* Tab Switcher */}
                        <div className="flex bg-[#12121e]/80 backdrop-blur-md border border-[#1e1e35] rounded-2xl p-1 mb-3 w-fit mx-auto shadow-xl">
                            {[
                                { id: 'screenshot', icon: '📸', label: 'Screenshot' },
                                { id: 'files', icon: '📁', label: 'Files' },
                                { id: 'paste', icon: '📝', label: 'Paste' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setInputTab(tab.id as any)}
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                        inputTab === tab.id 
                                        ? 'bg-[#4f8ef7] text-white shadow-lg' 
                                        : 'text-[#555577] hover:text-[#c0c0e0]'
                                    }`}
                                >
                                    <span>{tab.icon}</span>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Input Area */}
                        <div className="bg-[#12121e]/90 backdrop-blur-xl border border-[#1e1e35] rounded-[2rem] p-2 shadow-2xl relative group focus-within:border-[#4f8ef7]/50 transition-all duration-300">
                            {attachments.length > 0 && (
                                <div className="flex gap-2 p-3 overflow-x-auto custom-scrollbar border-b border-[#1e1e35] mb-2">
                                    {attachments.map((file, idx) => (
                                        <div key={idx} className="relative group/thumb shrink-0">
                                            <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 bg-black/40 shadow-lg">
                                                {file.mimeType === 'application/pdf' ? (
                                                    <div className="w-full h-full flex flex-col items-center justify-center">
                                                        <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /></svg>
                                                        <span className="text-[6px] font-black uppercase text-gray-500">PDF</span>
                                                    </div>
                                                ) : (
                                                    <img src={file.preview} alt="Attachment" className="w-full h-full object-cover" />
                                                )}
                                            </div>
                                            <button 
                                                onClick={() => removeAttachment(idx)}
                                                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity shadow-lg"
                                            >
                                                <svg width={10} height={10} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-end gap-2 pr-2">
                                <div className="flex-1 relative">
                                    {inputTab === 'screenshot' && (
                                        <div className="flex gap-2 pl-2 pb-2">
                                            <ScreenshotCapture onCapture={handleCapture} onError={setError} />
                                            <WebcamCapture onCapture={handleCapture} onError={setError} />
                                        </div>
                                    )}
                                    {inputTab === 'files' && (
                                        <div className="px-3 pb-2 text-[10px] text-[#555577] font-bold uppercase tracking-widest flex items-center gap-2">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                            Click plus to add files
                                        </div>
                                    )}
                                    <textarea
                                        rows={Math.min(5, input.split('\n').length)}
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSend();
                                            }
                                        }}
                                        placeholder={
                                            inputTab === 'screenshot' ? "Describe what to solve in the photo..." :
                                            inputTab === 'files' ? "Describe what to analyze in these files..." :
                                            "Paste text or type your challenge here..."
                                        }
                                        className="w-full bg-transparent border-none focus:ring-0 text-[#d8d8f0] text-sm resize-none py-3 px-4 placeholder-[#444466] leading-relaxed custom-scrollbar"
                                    />
                                </div>
                                
                                <div className="flex items-center gap-1.5 pb-2">
                                    <input
                                        type="file"
                                        id="file-upload"
                                        multiple
                                        className="hidden"
                                        onChange={handleFileUpload}
                                    />
                                    <label htmlFor="file-upload" className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#555577] hover:text-[#4f8ef7] hover:bg-[#4f8ef7]/10 transition-all cursor-pointer">
                                        <svg width={20} height={20} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    </label>
                                    <VoiceRecorder 
                                        onTranscription={(text: string) => setInput(prev => prev ? `${prev} ${text}` : text)}
                                        onError={(err: string) => setError(err)}
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={isLoading || (!input.trim() && attachments.length === 0)}
                                        className="w-10 h-10 bg-[#4f8ef7] hover:bg-[#3d7ed9] disabled:opacity-30 disabled:hover:bg-[#4f8ef7] text-white rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-95 group/btn"
                                    >
                                        {isLoading ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <svg width={18} height={18} fill="none" stroke="currentColor" viewBox="0 0 24 24" className="rotate-90 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9-7-9-7V19z" /></svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Status Bar */}
                        <div className="mt-3 flex items-center justify-between px-4">
                            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-[#444466]">
                                <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500 pulse-dot" /> System Active</span>
                                <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[#4f8ef7]" /> {mode} MODE</span>
                            </div>
                            <div className="text-[10px] font-bold text-[#444466] uppercase tracking-widest leading-none">
                                Ask Connie Ai • Intelligence v2.0
                            </div>
                        </div>
                    </div>
                </footer>

                {error && (
                    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-red-500/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl text-xs font-bold shadow-2xl z-[100] animate-in slide-in-from-bottom-4 duration-300 flex items-center gap-3">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {error}
                        <button onClick={() => setError(null)} className="ml-2 hover:opacity-70 transition-colors">CLOSE</button>
                    </div>
                )}
            </div>
        </div>
    );
}
