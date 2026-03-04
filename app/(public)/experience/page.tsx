'use client';
import React from 'react';
import { useLang } from '@/components/LangContext';
import Link from 'next/link';

const darkStyle = { backgroundColor: 'hsl(30 15% 7%)', color: 'hsl(38 50% 92%)' };
const cardStyle = { background: 'linear-gradient(135deg, hsl(30 12% 11%) 0%, hsl(30 10% 14%) 100%)', border: '1px solid hsl(30 10% 18%)', boxShadow: '0 8px 32px -8px hsl(0 0% 0% / 0.4)' };
const amber = 'hsl(36 80% 55%)';
const cream = 'hsl(38 50% 92%)';
const dimmed = 'hsl(38 50% 92% / 0.6)';

export default function ExperiencePage() {
  const { dict, locale } = useLang();
  const e = dict.experience;
  const isBg = locale === 'bg';

  return (
    <div style={darkStyle} className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {/* Header */}
        <div className="mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-body font-medium tracking-widest uppercase mb-6"
                style={{ backgroundColor: 'hsl(36 80% 55% / 0.1)', color: amber, border: '1px solid hsl(36 80% 55% / 0.2)' }}>
            ✨ {isBg ? 'Как работи' : 'How it works'}
          </span>
          <h1 className="font-display text-4xl sm:text-5xl font-bold mb-4" style={{ color: cream }}>
            {e.title}
          </h1>
          <p className="font-body text-xl leading-relaxed" style={{ color: dimmed }}>
            {e.whatIsCopy}
          </p>
        </div>

        {/* What is MEafterMe */}
        <section className="mb-12">
          <h2 className="font-display text-2xl font-bold mb-4" style={{ color: cream }}>{e.whatIsTitle}</h2>
          <ul className="space-y-4">
            {e.whatIsBullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-3 font-body" style={{ color: dimmed }}>
                <span className="mt-0.5 w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold"
                      style={{ backgroundColor: 'hsl(36 80% 55% / 0.15)', color: amber }}>
                  ✓
                </span>
                <span className="text-base leading-relaxed">{bullet}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Capture methods */}
        <section className="mb-8 p-8 rounded-2xl" style={cardStyle}>
          <h2 className="font-display text-xl font-bold mb-3" style={{ color: amber }}>
            🎙️ {e.captureTitle}
          </h2>
          <p className="font-body leading-relaxed" style={{ color: dimmed }}>{e.captureCopy}</p>
        </section>

        {/* Consent first */}
        <section className="mb-12 p-8 rounded-2xl" style={{ ...cardStyle, border: '1px solid hsl(36 80% 55% / 0.3)' }}>
          <h2 className="font-display text-xl font-bold mb-3" style={{ color: amber }}>
            🔒 {e.consentTitle}
          </h2>
          <p className="font-body leading-relaxed" style={{ color: dimmed }}>{e.consentCopy}</p>
        </section>

        {/* Step flow */}
        <section className="mb-12">
          <h2 className="font-display text-xl font-bold mb-6" style={{ color: cream }}>
            {isBg ? 'Студийният процес' : 'The Studio flow'}
          </h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {(isBg
              ? ['Създай профил', 'Качи съгласие', 'Starter 100', 'Запиши отговори', 'Семейството пита']
              : ['Create Profile', 'Consent Upload', 'Starter 100', 'Record Answers', 'Family Asks']
            ).map((step, i, arr) => (
              <React.Fragment key={step}>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl min-w-0 flex-1" style={cardStyle}>
                  <div className="w-8 h-8 rounded-full text-sm font-bold flex-shrink-0 flex items-center justify-center font-body"
                       style={{ backgroundColor: 'hsl(36 80% 55% / 0.2)', color: amber }}>
                    {i + 1}
                  </div>
                  <span className="font-body text-sm font-medium leading-tight" style={{ color: cream }}>{step}</span>
                </div>
                {i < arr.length - 1 && (
                  <div className="hidden sm:block text-xl flex-shrink-0" style={{ color: 'hsl(30 10% 30%)' }}>→</div>
                )}
              </React.Fragment>
            ))}
          </div>
        </section>

        {/* CTAs */}
        <div className="flex flex-wrap gap-4">
          <Link href="/login"
            className="font-body font-bold px-7 py-3 rounded-full transition-all hover:scale-105"
            style={{ backgroundColor: amber, color: 'hsl(30 15% 7%)' }}>
            {isBg ? 'Започни безплатно' : 'Start for free'}
          </Link>
          <Link href="/demo"
            className="font-body font-semibold px-7 py-3 rounded-full transition-all"
            style={{ backgroundColor: 'hsl(30 12% 11%)', color: cream, border: '1px solid hsl(30 10% 18%)' }}>
            {dict.header.nav.demo.label}
          </Link>
        </div>
      </div>
    </div>
  );
}
