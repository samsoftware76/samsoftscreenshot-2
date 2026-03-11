'use client';

import { useState } from 'react';
import { getDifficultyColor, getDifficultyText } from '@/lib/utils';

interface SolutionStepsProps {
  challenge: string;
  steps: string[];
  hints: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  explanation?: string;
  code?: string;
  language?: string;
  textOutput?: string;
}

export default function SolutionSteps({
  challenge,
  steps,
  hints,
  difficulty,
  explanation,
  code,
  language,
  textOutput,
}: SolutionStepsProps) {
  const [activeTab, setActiveTab] = useState<'code' | 'steps' | 'hints' | 'text'>(
    textOutput ? 'text' : code ? 'code' : 'steps'
  );
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const toggleStep = (index: number) => {
    setCompletedSteps((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#111] rounded-[2rem] shadow-2xl border border-black/5 dark:border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-6 md:p-8 bg-black dark:bg-white text-white dark:text-black">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter">Solution Intelligence</h2>
          <span
            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getDifficultyColor(difficulty)}`}
          >
            {getDifficultyText(difficulty)}
          </span>
        </div>
        <p className="text-sm md:text-base font-medium leading-relaxed opacity-90">{challenge}</p>
        {explanation && (
          <p className="text-xs mt-3 italic opacity-70 border-l-2 border-white/30 pl-3">{explanation}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-black/5 dark:border-white/10 px-6 bg-gray-50 dark:bg-black/40">
        {code && (
          <button
            onClick={() => setActiveTab('code')}
            className={`px-4 py-4 font-black text-[10px] uppercase tracking-widest transition-all relative ${activeTab === 'code'
              ? 'text-black dark:text-white'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
              }`}
          >
            💻 Code
            {activeTab === 'code' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black dark:bg-white" />
            )}
          </button>
        )}
        {textOutput && (
          <button
            onClick={() => setActiveTab('text')}
            className={`px-4 py-4 font-black text-[10px] uppercase tracking-widest transition-all relative ${activeTab === 'text'
              ? 'text-black dark:text-white'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
              }`}
          >
            📝 Essay
            {activeTab === 'text' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black dark:bg-white" />
            )}
          </button>
        )}
        <button
          onClick={() => setActiveTab('steps')}
          className={`px-4 py-4 font-black text-[10px] uppercase tracking-widest transition-all relative ${activeTab === 'steps'
            ? 'text-black dark:text-white'
            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
            }`}
        >
          Steps ({steps.length})
          {activeTab === 'steps' && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black dark:bg-white" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('hints')}
          className={`px-4 py-4 font-black text-[10px] uppercase tracking-widest transition-all relative ${activeTab === 'hints'
            ? 'text-black dark:text-white'
            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
            }`}
        >
          Hints ({hints.length})
          {activeTab === 'hints' && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black dark:bg-white" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
        {activeTab === 'code' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 italic">
                {language ? `DETECTED: ${language}` : 'SOLVER OUTPUT'}
              </span>
              <button
                onClick={copyCode}
                className="flex items-center gap-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl hover:scale-105 active:scale-95 transition-all text-[10px] font-black uppercase tracking-widest"
              >
                {copied ? 'Copied' : 'Copy Code'}
              </button>
            </div>
            <pre className="bg-[#0D0D0D] text-green-400 p-6 rounded-2xl overflow-x-auto text-sm leading-relaxed border border-white/5 shadow-2xl font-mono">
              <code>{code}</code>
            </pre>
          </div>
        ) : activeTab === 'text' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 italic">
                Academic Response (Humanized)
              </span>
            </div>
            <div className="bg-white dark:bg-transparent text-gray-900 dark:text-gray-200 p-8 rounded-2xl text-[15px] leading-loose whitespace-pre-wrap border border-black/5 dark:border-white/5 shadow-inner">
              {textOutput}
            </div>
          </div>
        ) : activeTab === 'steps' ? (
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`group flex gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer ${completedSteps.has(index)
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-black/5 dark:bg-white/5 border-transparent hover:border-black/10 dark:hover:border-white/10'
                  }`}
                onClick={() => toggleStep(index)}
              >
                <div className="flex-shrink-0 mt-1">
                  {completedSteps.has(index) ? (
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-black dark:bg-white flex items-center justify-center text-white dark:text-black text-[10px] font-black shadow-lg">
                      {index + 1}
                    </div>
                  )}
                </div>
                <p className={`text-[14px] font-medium leading-relaxed ${completedSteps.has(index) ? 'text-gray-500 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
                  {step}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {hints.map((hint, index) => (
              <div
                key={index}
                className="flex gap-4 p-5 bg-yellow-500/10 border-2 border-yellow-500/20 rounded-2xl"
              >
                <div className="flex-shrink-0 mt-1">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                </div>
                <p className="text-[14px] font-bold text-yellow-700 dark:text-yellow-500 leading-relaxed italic">{hint}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progress Footer */}
      <div className="px-6 md:px-8 py-5 border-t border-black/5 dark:border-white/10 bg-gray-50 dark:bg-black/60">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-500">
          <span>{completedSteps.size} of {steps.length} Milestones Hit</span>
          <div className="flex items-center gap-4">
            <div className="w-32 bg-gray-200 dark:bg-white/10 rounded-full h-1.5 overflow-hidden shadow-inner">
              <div
                className="bg-black dark:bg-white h-full transition-all duration-700 ease-out"
                style={{ width: `${(completedSteps.size / steps.length) * 100}%` }}
              />
            </div>
            <span className="text-black dark:text-white tabular-nums">
              {Math.round((completedSteps.size / steps.length) * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
