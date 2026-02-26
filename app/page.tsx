'use client';
import Link from 'next/link';
import { useLang } from '@/components/LangContext';

export default function HomePage() {
  const { dict } = useLang();
  const h = dict.home;
  const hHero = h.hero;

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-warm-400 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 text-center">
          {/* Trust chips */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {hHero.chips.map((chip) => (
              <span key={chip} className="bg-white/15 backdrop-blur-sm border border-white/25 text-white/90 text-xs font-medium px-3 py-1.5 rounded-full">
                {chip}
              </span>
            ))}
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-5">
            {hHero.headline}
          </h1>
          <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto mb-10 leading-relaxed">
            {hHero.subheadline}
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/waitlist"
              className="bg-white text-brand-700 font-bold px-7 py-3.5 rounded-xl hover:bg-brand-50 transition-colors shadow-lg text-base">
              {hHero.ctaPrimary}
            </Link>
            <Link href="/demo"
              className="border border-white/40 text-white font-semibold px-7 py-3.5 rounded-xl hover:bg-white/10 transition-colors text-base">
              {hHero.ctaSecondary}
            </Link>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-12">
            {h.howItWorks.title}
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {h.howItWorks.steps.map((step) => (
              <div key={step.num} className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-brand-600 text-white flex items-center justify-center text-xl font-bold mb-4 shadow-md">
                  {step.num}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2 text-lg">{step.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What you create ── */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-12">
            {h.whatYouCreate.title}
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {h.whatYouCreate.cards.map((card) => (
              <div key={card.title} className="bg-gray-50 border border-gray-100 rounded-2xl p-8 text-center hover:shadow-md transition-shadow">
                <div className="text-4xl mb-4">{card.icon}</div>
                <h3 className="font-bold text-gray-900 mb-3 text-lg">{card.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Private beta gating ── */}
      <section className="py-16 bg-gradient-to-r from-brand-900 to-brand-700 text-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-block bg-white/15 text-white/90 text-xs font-semibold px-3 py-1.5 rounded-full mb-5 uppercase tracking-wide">
            Private Beta
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">{h.betaGating.title}</h2>
          <p className="text-white/80 text-lg mb-8">{h.betaGating.copy}</p>
          <Link href="/waitlist"
            className="inline-block bg-white text-brand-700 font-bold px-8 py-3.5 rounded-xl hover:bg-brand-50 transition-colors shadow-lg">
            {h.betaGating.cta}
          </Link>
        </div>
      </section>
    </>
  );
}
