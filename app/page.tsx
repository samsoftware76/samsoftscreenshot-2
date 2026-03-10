'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ScreenshotCapture from '@/components/ScreenshotCapture';
import WebcamCapture from '@/components/WebcamCapture';
import type { AnalysisMode, MediaFile, MessagePayload } from '@/lib/chat';
import { downloadAsTxt, downloadAsPdf, downloadAsDocx, downloadAsCsv, downloadAsExcel } from '@/lib/export';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import AuthUI from '@/components/Auth';
import PaymentUI from '@/components/PaymentUI';

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
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
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

export default function Home() {
  const [messages, setMessages] = useState<MessagePayload[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<MediaFile[]>([]);
  const [mode, setMode] = useState<AnalysisMode>('general');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);

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

  // Sync Supabase History if logged in
  useEffect(() => {
    if (session) {
      const loadSupabaseHistory = async () => {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(100);

        if (data && data.length > 0) {
          const formattedMessages: MessagePayload[] = data.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            text: m.content
          }));
          setMessages(formattedMessages);
        }
      };
      loadSupabaseHistory();
    }
  }, [session]);

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
    localStorage.removeItem('chat_history');
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCapture = (data: string) => {
    // data is base64 string
    const base64Data = data.includes('base64,') ? data.split('base64,')[1] : data;
    if (attachments.length >= 10) {
      setError('Maximum 10 files allowed');
      return;
    }
    setAttachments(prev => [...prev, { data: base64Data, mimeType: 'image/png' }]);
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

        // determine mimeType roughly
        let mimeType = 'image/png';
        if (file.type === 'application/pdf') mimeType = 'application/pdf';
        else if (file.type === 'image/jpeg' || file.type === 'image/jpg') mimeType = 'image/jpeg';
        else if (file.type === 'image/webp') mimeType = 'image/webp';
        else if (file.type === 'image/gif') mimeType = 'image/gif';

        setAttachments(prev => [...prev, { data: base64Data, mimeType }]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = ''; // Reset
    setError(null);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;

    const userMessage: MessagePayload = {
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
      // Save user message to database if logged in
      if (session) {
        supabase.from('chat_messages').insert({
          user_id: session.user.id,
          role: 'user',
          content: userMessage.text
        }).then();
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory, mode }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Error communicating with AI');
      }

      const aiText = result.text;
      setMessages(prev => [...prev, { role: 'model', text: aiText }]);

      // Save ai message to database if logged in
      if (session) {
        supabase.from('chat_messages').insert({
          user_id: session.user.id,
          role: 'assistant',
          content: aiText
        }).then();
      }
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
    <div className="flex flex-col h-screen bg-[#FCF1E9] dark:bg-[#0A0A0A] font-sans transition-colors duration-300">
      {/* Header */}
      <header className="flex-shrink-0 bg-white/90 dark:bg-black/90 backdrop-blur-xl border-b border-gray-200/50 dark:border-white/10 px-3 sm:px-6 md:px-8 py-3 flex items-center justify-between z-30 sticky top-0 shadow-sm">
        <button
          onClick={resetApp}
          className="flex items-center gap-2 sm:gap-3 group transition-all active:scale-95 min-w-0"
          title="Go to Home"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-black rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-black/20 transition-all overflow-hidden border border-white/10 flex-shrink-0">
            <img src="/logo.svg" alt="Sam Software Logo" className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <div className="text-left truncate">
            <h1 className="text-sm sm:text-lg font-bold text-black dark:text-white tracking-tight leading-none group-hover:text-gray-600 transition-colors truncate">Software Challenge Solver</h1>
            <p className="hidden sm:block text-[10px] font-bold text-gray-400 tracking-[0.15em] uppercase mt-0.5">International</p>
          </div>
        </button>

        {/* Mode Selector - Desktop */}
        <div className="hidden lg:flex bg-gray-200/50 dark:bg-white/5 p-1 rounded-xl border border-black/5 dark:border-white/5 gap-1">
          {(['general', 'code', 'essay', 'handwriting'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all duration-200 ${mode === m
                ? 'bg-[#141413] text-white shadow-xl scale-105'
                : 'text-gray-500 hover:text-[#141413] dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/10'
                }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:flex flex-col items-end mr-1 sm:mr-2">
            <span className="text-[9px] font-black text-black dark:text-gray-400 uppercase tracking-widest">{session.user.email?.split('@')[0]}</span>
            <button
              onClick={handleSignOut}
              className="text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors uppercase tracking-tight"
            >
              Sign Out
            </button>
          </div>
          <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-black flex items-center justify-center border border-white/10 flex-shrink-0 shadow-lg">
            <span className="text-white text-xs font-black uppercase">
              {session.user.email?.[0] || 'U'}
            </span>
          </div>
          <button
            onClick={() => setShowPayment(true)}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black text-[10px] font-black uppercase tracking-widest rounded-xl shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
            UPGRADE
          </button>
        </div>
      </header >

      {/* Payment Modal */}
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

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto px-4 md:px-0 py-8 space-y-8 scroll-smooth" >
        <div className="max-w-4xl mx-auto space-y-8">
          {mode === 'handwriting' && messages.length === 0 && (
            <div className="text-center py-12 px-6 bg-white/20 dark:bg-white/5 rounded-3xl border border-black/5 dark:border-white/5 backdrop-blur-sm shadow-sm">
              <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-black dark:text-white mb-2 leading-tight">Handwriting to Text OCR</h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto font-medium">Upload up to 10 photos and I will transcribe them with high precision.</p>
            </div>
          )
          }

          {
            messages.length === 0 && mode !== 'handwriting' && (
              <div className="flex flex-col items-center justify-center py-12 sm:py-20 px-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-black rounded-full flex items-center justify-center shadow-xl mb-6 sm:mb-8 overflow-hidden">
                  <img src="/logo.svg" alt="Sam Software Logo" className="w-10 h-10 sm:w-12 sm:h-12" />
                </div>
                <h2 className="text-[28px] xs:text-3xl sm:text-4xl font-extrabold text-black dark:text-white tracking-tighter mb-4 text-center leading-tight">Software Challenge Solver.</h2>
                <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 font-medium text-center max-w-md px-2">Military-grade AI partner for code, essays, and handwriting.</p>

                <div className="grid grid-cols-2 gap-2 sm:gap-4 mt-8 sm:mt-12 w-full max-w-lg px-2 sm:px-4 lg:hidden">
                  {(['general', 'code', 'essay', 'handwriting'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold uppercase tracking-tighter transition-all flex items-center justify-center gap-2 border-2 ${mode === m
                        ? 'bg-black text-white border-black shadow-lg scale-105'
                        : 'bg-white dark:bg-white/5 text-gray-400 border-gray-100 dark:border-white/10 hover:border-gray-200'
                        }`}
                    >
                      <span className="text-[9px] sm:text-[10px]">{m}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          }

          {
            messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`max-w-[92%] md:max-w-[85%] rounded-[2rem] p-5 md:p-8 shadow-md transition-all ${msg.role === 'user'
                  ? 'bg-[#141413] text-white rounded-br-md border border-white/5'
                  : 'bg-white dark:bg-[#1A1A1A] text-black dark:text-white border border-black/5 dark:border-white/10 rounded-bl-md'
                  }`}>

                  {msg.role === 'model' && (
                    <div className="flex items-center gap-2 mb-4 opacity-50">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-[9px] font-black uppercase tracking-[0.2em]">Military Grade Output</span>
                    </div>
                  )}

                  {/* User Attached Files Display */}
                  {msg.files && msg.files.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {msg.files.map((file, fIdx) => (
                        <div key={fIdx} className="w-20 h-20 rounded-xl overflow-hidden shadow-md border-2 border-white/20 dark:border-white/10 bg-black/5 relative group transition-transform hover:scale-105 cursor-pointer">
                          {file.mimeType === 'application/pdf' ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-white text-red-600">
                              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /></svg>
                              <span className="text-[10px] font-black mt-1 uppercase tracking-widest">PDF</span>
                            </div>
                          ) : (
                            <img src={`data:${file.mimeType};base64,${file.data}`} alt="attachment" className="w-full h-full object-cover" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Message Text */}
                  {msg.role === 'model' ? (
                    <>
                      <div className="prose prose-neutral dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/90 prose-pre:border prose-pre:border-white/10 prose-code:text-blue-500 dark:prose-code:text-blue-400 text-black dark:text-white">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                      </div>
                      <MessageActions text={msg.text} />
                    </>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm md:text-base font-medium leading-relaxed tracking-tight text-white">{msg.text}</p>
                  )}
                </div>
              </div>
            ))}

          {isLoading && (
            <div className="flex justify-start animate-in fade-in slide-in-from-bottom-1 duration-500">
              <div className="bg-white/50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-3xl px-6 py-4 shadow-sm flex items-center gap-4 text-[#141413] dark:text-gray-400">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                </div>
                <span className="text-xs font-bold uppercase tracking-widest ">Thinking</span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Input Area */}
      <footer className="bg-white/80 dark:bg-black/50 backdrop-blur-xl border-t border-gray-200/50 dark:border-white/10 p-4 md:p-6 shrink-0 transition-all">
        <div className="max-w-4xl mx-auto">

          {error && <div className="text-red-500 text-xs font-bold bg-red-50 dark:bg-red-950/20 px-4 py-3 rounded-2xl border border-red-100 dark:border-red-900/30 mb-4 animate-in slide-in-from-top-2">{error}</div>}

          {/* Attachments Preview Row */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-4 px-2">
              {attachments.map((file, idx) => (
                <div key={idx} className="relative group w-16 h-16 rounded-2xl overflow-hidden border-2 border-white dark:border-white/10 shadow-xl bg-gray-100 flex items-center justify-center transition-transform hover:scale-105">
                  {file.mimeType === 'application/pdf' ? (
                    <span className="text-xs font-black text-red-600">PDF</span>
                  ) : (
                    <img src={`data:${file.mimeType};base64,${file.data}`} alt="preview" className="w-full h-full object-cover" />
                  )}
                  <button onClick={() => removeAttachment(idx)} className="absolute top-1 right-1 bg-black text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-red-500">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative group transition-all">
            <div className="absolute inset-0 bg-[#141413]/5 dark:bg-white/5 rounded-[2rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity"></div>

            <div className="relative flex items-end gap-1 sm:gap-2 bg-white dark:bg-black/40 p-1 sm:p-2 rounded-[1.25rem] sm:rounded-[1.5rem] border border-black/10 dark:border-white/10 shadow-2xl transition-all focus-within:border-black dark:focus-within:border-white/40 ring-0 min-w-0">

              <div className="flex items-center gap-0 sm:gap-0.5 shrink-0 px-0.5 sm:px-1">
                {/* File Upload Button */}
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    title="Upload Files"
                    disabled={isLoading || attachments.length >= 10}
                  />
                  <button
                    type="button"
                    className="p-2 sm:p-3 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                  >
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  </button>
                </div>

                {/* Mobile Camera Integration - Native Capture */}
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    title="Take Photo"
                    disabled={isLoading || attachments.length >= 10}
                  />
                  <button
                    type="button"
                    className="p-2 sm:p-3 text-gray-400 hover:text-green-600 transition-colors"
                  >
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </button>
                </div>

                {/* Screenshot Button (Hidden on ultra-small) */}
                <div className="hidden xs:block">
                  <ScreenshotCapture onCapture={handleCapture} onError={setError} />
                </div>

                {/* Webcam Button */}
                <div className="hidden md:block">
                  <WebcamCapture onCapture={handleCapture} onError={setError} />
                </div>
              </div>

              <textarea
                className="flex-1 max-h-48 min-h-[48px] sm:min-h-[56px] w-full resize-none bg-transparent py-3 sm:py-4 px-1 sm:px-2 text-black dark:text-white placeholder-gray-400 focus:outline-none text-[15px] sm:text-[16px] leading-relaxed font-medium min-w-0"
                placeholder={`Ask ${mode}...`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                rows={1}
              />

              <button
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && attachments.length === 0)}
                className="mb-1 mr-1 p-4 bg-[#141413] dark:bg-white text-white dark:text-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-20 disabled:hover:scale-100 disabled:cursor-not-allowed shrink-0"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between mt-8 md:mt-10 px-4 gap-6">
            <div className="hidden md:flex items-center gap-6">
              <div className={`w-2 h-2 ${isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'} rounded-full animate-pulse transition-all`}></div>
              <span className={`text-[10px] font-bold ${isOnline ? 'text-gray-400' : 'text-red-400'} tracking-widest uppercase`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            <div className="flex flex-col items-center md:items-end gap-2 text-center md:text-right">
              <p className="text-[11px] font-bold text-black dark:text-white tracking-tight opacity-80 uppercase">Sam Software LLC International</p>
              <div className="flex flex-wrap justify-center md:justify-end gap-5 text-[11px] font-medium text-gray-500 lowercase transition-all" style={{ fontVariant: 'small-caps' }}>
                <a
                  href="https://wa.me/256783647260"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-black dark:hover:text-white transition-colors group"
                >
                  <svg className="w-3.5 h-3.5 fill-current text-green-600 group-hover:text-green-500 transition-colors" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  +256 783 647260 WhatsApp
                </a>
                <a href="mailto:samsoftware75@gmail.com" className="hover:text-black dark:hover:text-white transition-colors">
                  samsoftware75@gmail.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
