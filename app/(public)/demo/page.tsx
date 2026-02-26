'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useLang } from '@/components/LangContext';

interface DemoMessage {
  type: 'user' | 'answer' | 'nomatch' | 'suggest';
  text: string;
  chipIndex?: number;
  suggestions?: number[];
}

export default function DemoPage() {
  const { dict } = useLang();
  const d = dict.demo;
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [input, setInput] = useState('');
  const [activeChip, setActiveChip] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function findChipMatch(query: string): number[] {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return d.chips
      .map((chip, i) => ({ i, score: chip.toLowerCase().includes(q) ? 2 : levenshteinSim(q, chip.toLowerCase()) }))
      .filter(x => x.score > 0.25)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(x => x.i);
  }

  function levenshteinSim(a: string, b: string): number {
    // Simple word overlap similarity
    const wa = new Set(a.split(/\s+/));
    const wb = new Set(b.split(/\s+/));
    let common = 0;
    wa.forEach(w => { if (wb.has(w)) common++; });
    return common / Math.max(wa.size, wb.size, 1);
  }

  function handleChip(i: number) {
    setActiveChip(i);
    setMessages(prev => [
      ...prev,
      { type: 'user', text: d.chips[i] },
      { type: 'answer', text: d.chips[i], chipIndex: i },
    ]);
    setInput('');
  }

  function handleSend() {
    const q = input.trim();
    if (!q) return;
    // Check for exact chip match first
    const exactIdx = d.chips.findIndex(c => c.toLowerCase() === q.toLowerCase());
    if (exactIdx >= 0) {
      handleChip(exactIdx);
      setInput('');
      return;
    }
    // Fuzzy suggestions
    const suggestions = findChipMatch(q);
    setMessages(prev => [
      ...prev,
      { type: 'user', text: q },
      suggestions.length > 0
        ? { type: 'suggest', text: d.didYouMean, suggestions }
        : { type: 'nomatch', text: d.noMatch },
    ]);
    setInput('');
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8 text-center">
        <span className="inline-block bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-3">
          {d.badge}
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{d.title}</h1>
        <p className="text-gray-500 max-w-xl mx-auto text-sm sm:text-base">{d.subtitle}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 min-h-[520px]">
        {/* Left: chips */}
        <aside className="lg:w-72 flex-shrink-0">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-3">
            Suggested questions
          </p>
          <div className="flex flex-col gap-2">
            {d.chips.map((chip, i) => (
              <button
                key={i}
                onClick={() => handleChip(i)}
                className={`demo-chip ${activeChip === i ? 'active' : ''}`}
              >
                {chip}
              </button>
            ))}
          </div>
        </aside>

        {/* Right: chat */}
        <div className="flex-1 flex flex-col bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0" style={{ maxHeight: '420px' }}>
            {messages.length === 0 && (
              <div className="text-center text-gray-400 mt-12">
                <div className="text-3xl mb-2">💬</div>
                <p className="text-sm">{d.inputHelper}</p>
              </div>
            )}
            {messages.map((msg, idx) => {
              if (msg.type === 'user') {
                return (
                  <div key={idx} className="flex justify-end">
                    <div className="bg-brand-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-xs text-sm font-medium">
                      {msg.text}
                    </div>
                  </div>
                );
              }
              if (msg.type === 'answer') {
                return (
                  <div key={idx} className="flex justify-start animate-slide-up">
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm p-4 max-w-md shadow-sm">
                      <span className="inline-block bg-brand-100 text-brand-700 text-xs font-semibold px-2.5 py-1 rounded-full mb-3">
                        {d.previewBadge}
                      </span>
                      {/* Video skeleton */}
                      <div className="video-skeleton rounded-xl w-full h-32 mb-3 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-1">
                          <svg className="w-8 h-8 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                          <span className="text-gray-300 text-xs">{d.videoSkeleton}</span>
                        </div>
                      </div>
                      {/* Placeholder transcript */}
                      <div className="space-y-1.5 text-sm text-gray-700 italic">
                        {d.previewTranscript.map((line, li) => (
                          <p key={li}>{line}</p>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-3">{d.previewDisclaimer}</p>
                    </div>
                  </div>
                );
              }
              if (msg.type === 'suggest') {
                return (
                  <div key={idx} className="flex justify-start animate-fade-in">
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm p-4 max-w-md shadow-sm">
                      <p className="text-sm text-gray-600 mb-2 font-medium">{msg.text}</p>
                      <div className="flex flex-col gap-1.5">
                        {(msg.suggestions || []).map(si => (
                          <button key={si} onClick={() => handleChip(si)}
                            className="text-left text-sm text-brand-600 font-medium hover:underline">
                            → {d.chips[si]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }
              if (msg.type === 'nomatch') {
                return (
                  <div key={idx} className="flex justify-start animate-fade-in">
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-sm shadow-sm">
                      <p className="text-sm text-gray-500">{msg.text}</p>
                    </div>
                  </div>
                );
              }
              return null;
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 p-4 bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder={d.inputPlaceholder}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="bg-brand-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Ask
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">{d.inputHelper}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
