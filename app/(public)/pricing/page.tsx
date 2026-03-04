'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/components/LangContext';

const darkStyle = { backgroundColor: 'hsl(30 15% 7%)', color: 'hsl(38 50% 92%)' };
const cardStyle = { background: 'linear-gradient(135deg, hsl(30 12% 11%) 0%, hsl(30 10% 14%) 100%)', border: '1px solid hsl(30 10% 18%)', boxShadow: '0 8px 32px -8px hsl(0 0% 0% / 0.4)' };
const amber = 'hsl(36 80% 55%)';
const cream = 'hsl(38 50% 92%)';
const dimmed = 'hsl(38 50% 92% / 0.6)';

function CheckIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl overflow-hidden" style={cardStyle}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 text-left transition-colors"
        style={{ backgroundColor: 'transparent' }}
      >
        <span className="font-body font-semibold pr-4 text-sm" style={{ color: cream }}>{q}</span>
        <span className="text-xl transition-transform duration-200 flex-shrink-0"
              style={{ color: amber, transform: open ? 'rotate(45deg)' : 'none' }}>+</span>
      </button>
      {open && (
        <div className="px-5 pb-5 font-body text-sm leading-relaxed"
             style={{ color: dimmed, borderTop: '1px solid hsl(30 10% 18%)' }}>
          {a}
        </div>
      )}
    </div>
  );
}

export default function PricingPage() {
  const { dict, locale } = useLang();
  const p = dict.pricing as any;
  const [billingYearly, setBillingYearly] = useState(false);
  const isBg = locale === 'bg';

  return (
    <main style={darkStyle} className="min-h-screen">

      {/* ── Hero ── */}
      <section className="pt-24 pb-16 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse at center top, hsl(36 80% 55% / 0.06), transparent 60%)' }} />
        <div className="max-w-3xl mx-auto relative z-10">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-body font-medium tracking-widest uppercase mb-6"
                style={{ backgroundColor: 'hsl(36 80% 55% / 0.1)', color: amber, border: '1px solid hsl(36 80% 55% / 0.2)' }}>
            💎 {isBg ? 'Избери своето наследство' : 'Choose your legacy'}
          </span>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-5 leading-tight" style={{ color: cream }}>
            {p.hero.headline}
          </h1>
          {p.hero.quote && (
            <blockquote className="font-body text-base md:text-lg italic max-w-2xl mx-auto mb-6 pl-5 text-left"
                        style={{ color: dimmed, borderLeft: `3px solid ${amber}` }}>
              {p.hero.quote}
            </blockquote>
          )}
          <p className="font-body text-lg max-w-2xl mx-auto" style={{ color: dimmed }}>{p.hero.sub}</p>
        </div>
      </section>

      {/* ── Plans ── */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mb-14">
            <span className="font-body text-sm font-semibold"
                  style={{ color: !billingYearly ? cream : 'hsl(38 50% 92% / 0.4)' }}>
              {isBg ? 'Месечно' : 'Monthly'}
            </span>
            <button
              onClick={() => setBillingYearly(b => !b)}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              style={{ backgroundColor: billingYearly ? amber : 'hsl(30 10% 18%)' }}
            >
              <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                    style={{ transform: billingYearly ? 'translateX(1.5rem)' : 'translateX(0.25rem)' }} />
            </button>
            <span className="font-body text-sm font-semibold flex items-center gap-1.5"
                  style={{ color: billingYearly ? cream : 'hsl(38 50% 92% / 0.4)' }}>
              {isBg ? 'Годишно' : 'Yearly'}
              <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ backgroundColor: 'hsl(142 70% 50% / 0.15)', color: 'hsl(142 70% 60%)' }}>
                {isBg ? 'Спести' : 'Save'}
              </span>
            </span>
          </div>

          {/* Cards */}
          <div className="grid md:grid-cols-3 gap-8 items-start">
            {p.plans.map((plan: any) => {
              const price = billingYearly && plan.priceYear ? plan.priceYear : plan.price;
              const period = billingYearly && plan.periodYear ? plan.periodYear : plan.period;
              const checkoutHref = billingYearly && plan.id === 'premium'
                ? '/checkout?plan=premium_yearly'
                : plan.href;

              /* Free card */
              if (plan.id === 'free') return (
                <div key={plan.id} className="p-8 rounded-2xl flex flex-col" style={cardStyle}>
                  <h3 className="font-display text-xl font-bold mb-2" style={{ color: cream }}>{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="font-display text-4xl font-bold" style={{ color: cream }}>{price}</span>
                    {period && <span className="font-body text-sm" style={{ color: dimmed }}>/{period}</span>}
                  </div>
                  <ul className="space-y-3 mb-8 flex-grow">
                    {plan.features.map((f: string, i: number) => (
                      <li key={i} className="flex items-center gap-3 font-body text-sm" style={{ color: dimmed }}>
                        <span style={{ color: 'hsl(142 70% 50%)' }}><CheckIcon /></span>{f}
                      </li>
                    ))}
                  </ul>
                  <Link href={plan.href}
                    className="w-full py-3 px-6 rounded-full font-body font-semibold text-center text-sm transition-all"
                    style={{ backgroundColor: 'hsl(30 15% 7%)', color: cream, border: '1px solid hsl(30 10% 28%)' }}>
                    {plan.cta}
                  </Link>
                </div>
              );

              /* Premium card — ACCENT */
              if (plan.id === 'premium') return (
                <div key={plan.id} className="p-8 rounded-2xl relative md:-translate-y-4 flex flex-col"
                     style={{ background: 'linear-gradient(135deg, hsl(30 12% 13%) 0%, hsl(30 10% 16%) 100%)', border: `2px solid ${amber}`, boxShadow: `0 0 40px -10px ${amber}40` }}>
                  {plan.badge && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full text-xs font-body font-bold uppercase tracking-wide whitespace-nowrap"
                         style={{ backgroundColor: amber, color: 'hsl(30 15% 7%)' }}>
                      {plan.badge}
                    </div>
                  )}
                  <h3 className="font-display text-xl font-bold mb-2" style={{ color: cream }}>{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="font-display text-4xl font-bold" style={{ color: cream }}>{price}</span>
                    {period && <span className="font-body text-sm" style={{ color: dimmed }}>/{period}</span>}
                  </div>
                  <ul className="space-y-3 mb-6 flex-grow">
                    {plan.features.map((f: string, i: number) => (
                      <li key={i} className="flex items-center gap-3 font-body text-sm font-medium" style={{ color: cream }}>
                        <span style={{ color: amber }}><CheckIcon /></span>{f}
                      </li>
                    ))}
                  </ul>
                  <Link href={checkoutHref}
                    className="w-full py-4 px-6 rounded-full font-body font-bold text-base text-center mb-3 transition-all hover:scale-105"
                    style={{ backgroundColor: amber, color: 'hsl(30 15% 7%)' }}>
                    {plan.cta}
                  </Link>
                  <p className="font-body text-xs text-center" style={{ color: dimmed }}>{p.trustBadge?.guarantee}</p>
                </div>
              );

              /* Lifetime card */
              return (
                <div key={plan.id} className="p-8 rounded-2xl flex flex-col relative"
                     style={{ backgroundColor: 'hsl(30 8% 9%)', border: '1px solid hsl(36 80% 55% / 0.2)' }}>
                  {plan.badge && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full text-xs font-body font-bold uppercase tracking-wide whitespace-nowrap"
                         style={{ backgroundColor: 'hsl(36 90% 60%)', color: 'hsl(30 15% 7%)' }}>
                      {plan.badge}
                    </div>
                  )}
                  <h3 className="font-display text-xl font-bold mb-2" style={{ color: amber }}>{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="font-display text-4xl font-bold" style={{ color: cream }}>{price}</span>
                    {period && <span className="font-body text-sm italic" style={{ color: dimmed }}>/{period}</span>}
                  </div>
                  <ul className="space-y-3 mb-6 flex-grow">
                    {plan.features.map((f: string, i: number) => (
                      <li key={i} className="flex items-center gap-3 font-body text-sm" style={{ color: 'hsl(38 50% 92% / 0.8)' }}>
                        <span style={{ color: amber }}><CheckIcon /></span>{f}
                      </li>
                    ))}
                  </ul>
                  <Link href={plan.href}
                    className="w-full py-3 px-6 rounded-full font-body font-bold text-center text-sm mb-3 transition-all hover:scale-105"
                    style={{ backgroundColor: cream, color: 'hsl(30 15% 7%)' }}>
                    {plan.cta}
                  </Link>
                  <p className="font-body text-xs text-center" style={{ color: 'hsl(38 50% 92% / 0.3)' }}>{p.trustBadge?.guarantee}</p>
                </div>
              );
            })}
          </div>

          {/* Stripe note */}
          <div className="mt-8 text-center">
            <p className="font-body text-sm italic" style={{ color: 'hsl(38 50% 92% / 0.4)' }}>
              🔒 {p.trustBadge?.secure}
            </p>
          </div>
        </div>
      </section>

      {/* ── Why Premium ── */}
      <section className="py-16 px-6" style={{ backgroundColor: 'hsl(30 12% 11%)' }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-center mb-10" style={{ color: cream }}>
            {p.whyPremium?.title}
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {(p.whyPremium?.items || []).map((item: any, i: number) => (
              <div key={i} className="text-center px-4">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="font-display text-lg font-bold mb-2" style={{ color: cream }}>{item.title}</h3>
                <p className="font-body text-sm leading-relaxed" style={{ color: dimmed }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Gift CTA Banner ── */}
      <section className="py-12 px-6" style={{ backgroundColor: 'hsl(30 15% 7%)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="p-8 flex flex-col md:flex-row items-center gap-6 rounded-2xl"
               style={{ background: 'linear-gradient(135deg, hsl(0 70% 40% / 0.1), hsl(350 70% 40% / 0.05))', border: '1px solid hsl(0 70% 40% / 0.2)' }}>
            <div className="text-5xl flex-shrink-0">🎁</div>
            <div className="flex-1">
              <h3 className="font-display text-xl font-bold mb-1" style={{ color: cream }}>
                {isBg ? 'Подари история на любим човек' : 'Gift a story to someone you love'}
              </h3>
              <p className="font-body text-sm" style={{ color: dimmed }}>
                {isBg
                  ? 'Купи пакет за родителите си — те получават покана по имейл с насочващи въпроси.'
                  : 'Buy a package for your parents — they receive a personal email invitation with guided questions.'}
              </p>
            </div>
            <Link href="/gift"
              className="flex-shrink-0 font-body font-bold px-6 py-3 rounded-full whitespace-nowrap transition-all hover:scale-105"
              style={{ backgroundColor: 'hsl(0 70% 55%)', color: 'white' }}>
              {isBg ? 'Подари история →' : 'Gift a Story →'}
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-16 px-6" style={{ backgroundColor: 'hsl(30 12% 11%)' }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-center mb-10" style={{ color: cream }}>
            {p.faq.title}
          </h2>
          <div className="space-y-3">
            {p.faq.items.map((item: any, i: number) => (
              <FaqItem key={i} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="py-20 px-6 text-center relative overflow-hidden" style={{ backgroundColor: 'hsl(30 15% 7%)' }}>
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse at center, hsl(36 80% 55% / 0.06), transparent 70%)' }} />
        <div className="relative z-10 max-w-2xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4" style={{ color: cream }}>
            {p.bottomCta?.headline}
          </h2>
          <p className="font-body text-lg mb-8" style={{ color: dimmed }}>{p.bottomCta?.sub}</p>
          <Link href="/login"
            className="inline-block font-body font-bold px-10 py-4 rounded-full transition-all hover:scale-105 text-lg"
            style={{ backgroundColor: amber, color: 'hsl(30 15% 7%)' }}>
            {p.bottomCta?.cta || (isBg ? 'Започни сега →' : 'Get Started →')}
          </Link>
        </div>
      </section>

    </main>
  );
}
