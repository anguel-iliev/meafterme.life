'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/components/LangContext';

export default function GiftPage() {
  const { dict, locale } = useLang();
  const g = dict.gift;
  const [form, setForm] = useState({ recipientName: '', recipientEmail: '', senderName: '', message: '' });
  const [selectedPkg, setSelectedPkg] = useState('gift_lifetime');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      // Redirect to Stripe Checkout with gift details encoded
      const params = new URLSearchParams({
        plan: selectedPkg,
        recipientName: form.recipientName,
        recipientEmail: form.recipientEmail,
        senderName: form.senderName,
        message: form.message,
      });
      window.location.href = `/checkout?${params.toString()}`;
    } catch {
      setStatus('error');
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 to-white pt-24 pb-20">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 text-center mb-14">
        <div className="text-6xl mb-4">🎁</div>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
          {g.hero.headline}
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto">{g.hero.sub}</p>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 mb-16">
        <h2 className="font-display text-2xl font-bold text-center mb-10" style={{color:'hsl(38 50% 92%)'}}>{g.howItWorks.title}</h2>
        <div className="grid md:grid-cols-4 gap-6">
          {g.howItWorks.steps.map((step) => (
            <div key={step.num} className="text-center">
              <div className="w-12 h-12 rounded-full font-body font-bold text-xl flex items-center justify-center mx-auto mb-3"
                   style={{backgroundColor:'hsl(36 80% 55% / 0.15)',color:'hsl(36 80% 55%)'}}>
                {step.num}
              </div>
              <h3 className="font-display font-semibold mb-1 text-sm" style={{color:'hsl(38 50% 92%)'}}>{step.title}</h3>
              <p className="font-body text-xs leading-relaxed" style={{color:'hsl(38 50% 92% / 0.5)'}}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Gift form + packages ───────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 grid md:grid-cols-2 gap-10 mb-16">

        {/* Package selector */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            {locale === 'bg' ? 'Избери пакет' : 'Choose a package'}
          </h2>
          <div className="space-y-4">
            {g.packages.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => setSelectedPkg(pkg.id)}
                className={`w-full text-left p-5 rounded-2xl border-2 transition-all relative
                  ${selectedPkg === pkg.id
                    ? 'border-rose-400 bg-rose-50 shadow-md'
                    : 'border-gray-100 bg-white hover:border-gray-200'}`}
              >
                {pkg.badge && (
                  <span className="absolute -top-3 left-4 bg-rose-500 text-white text-xs font-bold px-3 py-0.5 rounded-full">
                    {pkg.badge}
                  </span>
                )}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-gray-900">{pkg.name}</div>
                    <div className="text-sm text-gray-500 mt-1">{pkg.desc}</div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <div className="text-2xl font-extrabold text-gray-900">{pkg.price}</div>
                    {selectedPkg === pkg.id && (
                      <div className="w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center mt-1 ml-auto">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Guarantee */}
          <div className="mt-6 bg-green-50 border border-green-100 rounded-xl p-4 flex gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <div className="font-semibold text-green-800 text-sm">
                {locale === 'bg' ? 'Сигурно плащане' : 'Secure payment'}
              </div>
              <div className="text-green-700 text-xs mt-0.5">
                {locale === 'bg'
                  ? 'Плащанията се обработват от Stripe. Ние не съхраняваме данни за карти.'
                  : 'Payments processed by Stripe. We never store card details.'}
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div>
          <h2 className="font-display text-xl font-bold mb-6" style={{color:'hsl(38 50% 92%)'}}>{g.form.title}</h2>
          {status === 'success' ? (
            <div className="rounded-2xl p-8 text-center" style={{backgroundColor:'hsl(142 70% 50% / 0.08)',border:'1px solid hsl(142 70% 50% / 0.2)'}}>
              <div className="text-5xl mb-4">🎁</div>
              <p className="font-body font-semibold text-lg" style={{color:'hsl(142 70% 60%)'}}>{g.form.success}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block font-body text-sm font-semibold mb-1" style={{color:'hsl(38 50% 92% / 0.8)'}}>{g.form.recipientName} *</label>
                <input
                  required
                  type="text"
                  value={form.recipientName}
                  onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))}
                  className="w-full rounded-xl px-4 py-3 font-body text-sm outline-none"
                  style={{backgroundColor:'hsl(30 15% 7%)',border:'1px solid hsl(30 10% 18%)',color:'hsl(38 50% 92%)'}}
                  placeholder={locale === 'bg' ? 'напр. Иван Петров' : 'e.g. John Smith'}
                />
              </div>
              <div>
                <label className="block font-body text-sm font-semibold mb-1" style={{color:'hsl(38 50% 92% / 0.8)'}}>{g.form.recipientEmail} *</label>
                <input
                  required
                  type="email"
                  value={form.recipientEmail}
                  onChange={e => setForm(f => ({ ...f, recipientEmail: e.target.value }))}
                  className="w-full rounded-xl px-4 py-3 font-body text-sm outline-none"
                  style={{backgroundColor:'hsl(30 15% 7%)',border:'1px solid hsl(30 10% 18%)',color:'hsl(38 50% 92%)'}}
                  placeholder="parent@example.com"
                />
              </div>
              <div>
                <label className="block font-body text-sm font-semibold mb-1" style={{color:'hsl(38 50% 92% / 0.8)'}}>{g.form.senderName} *</label>
                <input
                  required
                  type="text"
                  value={form.senderName}
                  onChange={e => setForm(f => ({ ...f, senderName: e.target.value }))}
                  className="w-full rounded-xl px-4 py-3 font-body text-sm outline-none"
                  style={{backgroundColor:'hsl(30 15% 7%)',border:'1px solid hsl(30 10% 18%)',color:'hsl(38 50% 92%)'}}
                  placeholder={locale === 'bg' ? 'напр. Мария' : 'e.g. Maria'}
                />
              </div>
              <div>
                <label className="block font-body text-sm font-semibold mb-1" style={{color:'hsl(38 50% 92% / 0.8)'}}>{g.form.message}</label>
                <textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  rows={3}
                  className="w-full rounded-xl px-4 py-3 font-body text-sm outline-none resize-none"
                  style={{backgroundColor:'hsl(30 15% 7%)',border:'1px solid hsl(30 10% 18%)',color:'hsl(38 50% 92%)'}}
                  placeholder={g.form.messagePlaceholder}
                />
              </div>
              {status === 'error' && (
                <p className="font-body text-sm" style={{color:'hsl(0 70% 60%)'}}>{g.form.error}</p>
              )}
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full font-body font-bold py-4 rounded-full transition-all hover:scale-105 disabled:opacity-50 text-sm"
                style={{backgroundColor:'hsl(36 80% 55%)',color:'hsl(30 15% 7%)'}}
              >
                {status === 'loading' ? '...' : g.form.send}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* ── Testimonial / Emotional block ─────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 text-center">
        <div className="rounded-2xl p-8" style={{background:'linear-gradient(135deg,hsl(30 12% 11%) 0%,hsl(30 10% 14%) 100%)',border:'1px solid hsl(30 10% 18%)'}}>
          <p className="font-display text-xl italic mb-4" style={{color:'hsl(38 50% 92% / 0.8)'}}>
            {locale === 'bg'
              ? '"Исках да запиша историите на баща ми, докато все още можеше да ги разказва. Сега децата ми ще го познаят винаги."'
              : '"I wanted to record my father\'s stories while he could still tell them. Now my children will know him forever."'}
          </p>
          <div className="font-body text-sm font-semibold" style={{color:'hsl(38 50% 92% / 0.4)'}}>
            {locale === 'bg' ? '— Мария, 42 г., купила Lifetime за баща си' : '— Maria, 42, gifted Lifetime to her father'}
          </div>
        </div>
      </section>
    </main>
  );
}
