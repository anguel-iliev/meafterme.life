'use client';
import React from 'react';
import { useLang } from '@/components/LangContext';
import Link from 'next/link';

export default function ExperiencePage() {
  const { dict } = useLang();
  const e = dict.experience;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">{e.title}</h1>
      <p className="text-gray-500 text-lg mb-12 border-b border-gray-100 pb-8">
        A private studio to record a life — in real answers.
      </p>

      {/* What is MEafterMe */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">{e.whatIsTitle}</h2>
        <p className="text-gray-700 text-lg mb-6">{e.whatIsCopy}</p>
        <ul className="space-y-3">
          {e.whatIsBullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-3 text-gray-700">
              <span className="mt-1 w-5 h-5 rounded-full bg-brand-600 flex-shrink-0 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Capture methods */}
      <section className="mb-12 bg-brand-50 rounded-2xl p-8 border border-brand-100">
        <h2 className="text-xl font-bold text-brand-800 mb-3">{e.captureTitle}</h2>
        <p className="text-brand-700 leading-relaxed">{e.captureCopy}</p>
      </section>

      {/* Consent first */}
      <section className="mb-12 bg-warm-50 rounded-2xl p-8 border border-warm-200">
        <h2 className="text-xl font-bold text-warm-800 mb-3">🔒 {e.consentTitle}</h2>
        <p className="text-warm-700 leading-relaxed">{e.consentCopy}</p>
      </section>

      {/* Step flow visual */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-gray-900 mb-6">The Studio flow</h2>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {['Create Profile', 'Consent Upload', 'Starter 100', 'Record Answers', 'Family Asks'].map((step, i) => (
            <React.Fragment key={step}>
              <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm min-w-0 flex-1">
                <div className="w-8 h-8 rounded-full bg-brand-600 text-white text-sm font-bold flex-shrink-0 flex items-center justify-center">
                  {i + 1}
                </div>
                <span className="text-sm font-medium text-gray-800 leading-tight">{step}</span>
              </div>
              {i < 4 && <div className="hidden sm:block text-gray-300 text-xl font-light flex-shrink-0">→</div>}
            </React.Fragment>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-4">
        <Link href="/waitlist"
          className="bg-brand-600 text-white font-bold px-7 py-3 rounded-xl hover:bg-brand-700 transition-colors">
          {dict.home.betaGating.cta}
        </Link>
        <Link href="/demo"
          className="border border-brand-300 text-brand-700 font-semibold px-7 py-3 rounded-xl hover:bg-brand-50 transition-colors">
          {dict.header.nav.demo.label}
        </Link>
      </div>
    </div>
  );
}
