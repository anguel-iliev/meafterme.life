'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useLang } from '@/components/LangContext';

const darkStyle = { backgroundColor: 'hsl(30 15% 7%)', color: 'hsl(38 50% 92%)' };
const cardStyle = { background: 'linear-gradient(135deg, hsl(30 12% 11%) 0%, hsl(30 10% 14%) 100%)', border: '1px solid hsl(30 10% 18%)' };
const amber = 'hsl(36 80% 55%)';
const cream = 'hsl(38 50% 92%)';
const dimmed = 'hsl(38 50% 92% / 0.6)';

interface DemoMessage {
  type: 'user' | 'answer' | 'nomatch' | 'suggest';
  text: string;
  chipIndex?: number;
  suggestions?: number[];
}

export default function DemoPage() {
  const { dict, locale } = useLang();
  const d = dict.demo;
  const isBg = locale === 'bg';
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
    const exactIdx = d.chips.findIndex(c => c.toLowerCase() === q.toLowerCase());
    if (exactIdx >= 0) {
      handleChip(exactIdx);
      setInput('');
      return;
    }
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
    <div style={darkStyle} className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8 text-center">
          <span className="inline-block text-xs font-body font-semibold px-3 py-1.5 rounded-full mb-3"
                style={{ backgroundColor: 'hsl(36 80% 55% / 0.15)', color: amber }}>
            {d.badge}
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold mb-2" style={{ color: cream }}>{d.title}</h1>
          <p className="font-body max-w-xl mx-auto text-sm sm:text-base" style={{ color: dimmed }}>{d.subtitle}</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 min-h-[520px]">
          {/* Left: chips */}
          <aside className="lg:w-72 flex-shrink-0">
            <p className="font-body text-xs uppercase tracking-wider font-semibold mb-3"
               style={{ color: amber }}>
              {isBg ? 'Предложени въпроси' : 'Suggested questions'}
            </p>
            <div className="flex flex-col gap-2">
              {d.chips.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => handleChip(i)}
                  className="text-left px-4 py-2.5 rounded-full font-body text-sm font-medium transition-all"
                  style={{
                    backgroundColor: activeChip === i ? amber : 'hsl(30 12% 11%)',
                    color: activeChip === i ? 'hsl(30 15% 7%)' : 'hsl(38 50% 92% / 0.8)',
                    border: activeChip === i ? `1px solid ${amber}` : '1px solid hsl(30 10% 18%)',
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </aside>

          {/* Right: chat */}
          <div className="flex-1 flex flex-col rounded-2xl overflow-hidden"
               style={cardStyle}>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0" style={{ maxHeight: '420px' }}>
              {messages.length === 0 && (
                <div className="text-center mt-12">
                  <div className="text-3xl mb-2">💬</div>
                  <p className="font-body text-sm" style={{ color: 'hsl(38 50% 92% / 0.4)' }}>{d.inputHelper}</p>
                </div>
              )}
              {messages.map((msg, idx) => {
                if (msg.type === 'user') {
                  return (
                    <div key={idx} className="flex justify-end">
                      <div className="rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-xs font-body text-sm font-medium"
                           style={{ backgroundColor: amber, color: 'hsl(30 15% 7%)' }}>
                        {msg.text}
                      </div>
                    </div>
                  );
                }
                if (msg.type === 'answer') {
                  return (
                    <div key={idx} className="flex justify-start animate-slide-up">
                      <div className="rounded-2xl rounded-tl-sm p-4 max-w-md"
                           style={{ backgroundColor: 'hsl(30 15% 7%)', border: '1px solid hsl(30 10% 18%)' }}>
                        <span className="inline-block text-xs font-body font-semibold px-2.5 py-1 rounded-full mb-3"
                              style={{ backgroundColor: 'hsl(36 80% 55% / 0.15)', color: amber }}>
                          {d.previewBadge}
                        </span>
                        {/* Video skeleton */}
                        <div className="video-skeleton rounded-xl w-full h-32 mb-3 flex items-center justify-center">
                          <div className="flex flex-col items-center gap-1">
                            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"
                                 style={{ color: 'hsl(38 50% 92% / 0.2)' }}>
                              <path d="M8 5v14l11-7z" />
                            </svg>
                            <span className="font-body text-xs" style={{ color: 'hsl(38 50% 92% / 0.3)' }}>
                              {d.videoSkeleton}
                            </span>
                          </div>
                        </div>
                        {/* Transcript */}
                        <div className="space-y-1.5 font-body text-sm italic">
                          {d.previewTranscript.map((line, li) => (
                            <p key={li} style={{ color: 'hsl(38 50% 92% / 0.7)' }}>{line}</p>
                          ))}
                        </div>
                        <p className="font-body text-xs mt-3" style={{ color: 'hsl(38 50% 92% / 0.4)' }}>
                          {d.previewDisclaimer}
                        </p>
                      </div>
                    </div>
                  );
                }
                if (msg.type === 'suggest') {
                  return (
                    <div key={idx} className="flex justify-start animate-fade-in">
                      <div className="rounded-2xl rounded-tl-sm p-4 max-w-md"
                           style={{ backgroundColor: 'hsl(30 15% 7%)', border: '1px solid hsl(30 10% 18%)' }}>
                        <p className="font-body text-sm mb-2 font-medium" style={{ color: cream }}>{msg.text}</p>
                        <div className="flex flex-col gap-1.5">
                          {(msg.suggestions || []).map(si => (
                            <button key={si} onClick={() => handleChip(si)}
                              className="text-left font-body text-sm font-medium hover:underline"
                              style={{ color: amber }}>
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
                      <div className="rounded-2xl rounded-tl-sm px-4 py-3 max-w-sm"
                           style={{ backgroundColor: 'hsl(30 15% 7%)', border: '1px solid hsl(30 10% 18%)' }}>
                        <p className="font-body text-sm" style={{ color: dimmed }}>{msg.text}</p>
                      </div>
                    </div>
                  );
                }
                return null;
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-4" style={{ borderTop: '1px solid hsl(30 10% 18%)' }}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder={d.inputPlaceholder}
                  className="flex-1 rounded-full px-4 py-2.5 font-body text-sm outline-none transition-all"
                  style={{ backgroundColor: 'hsl(30 15% 7%)', border: '1px solid hsl(30 10% 18%)', color: cream }}
                  onFocus={e => (e.currentTarget.style.border = `1px solid ${amber}`)}
                  onBlur={e => (e.currentTarget.style.border = '1px solid hsl(30 10% 18%)')}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 disabled:opacity-40"
                  style={{ backgroundColor: amber, color: 'hsl(30 15% 7%)' }}
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 3L13.43 10.57M21 3l-6.5 19a.5.5 0 01-.94.02L10 13 1 9.44a.5.5 0 01.02-.94L21 3z" />
                  </svg>
                </button>
              </div>
              <p className="font-body text-xs mt-2" style={{ color: 'hsl(38 50% 92% / 0.3)' }}>{d.inputHelper}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
