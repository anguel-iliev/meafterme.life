'use client';
import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/components/LangContext';

// ── Stripe Payment Links (direct — no backend needed) ─────────────────────────
const PAYMENT_LINKS: Record<string, {
  url: string;
  name: string;
  nameBg: string;
  amount: string;
  interval: string;
  isSubscription: boolean;
}> = {
  premium_monthly: {
    url: 'https://buy.stripe.com/aFa9AMaP65ABb4H0YncjS02',
    name: 'Legacy Premium — Monthly',
    nameBg: 'Legacy Premium — Месечно',
    amount: '€19.99',
    interval: '/мес',
    isSubscription: true,
  },
  premium_yearly: {
    url: 'https://buy.stripe.com/00w5kw1ewgff5KncH5cjS01',
    name: 'Legacy Premium — Yearly',
    nameBg: 'Legacy Premium — Годишно',
    amount: '€249',
    interval: '/год',
    isSubscription: true,
  },
  lifetime: {
    url: 'https://buy.stripe.com/cNi3coe1ie777Sv5eDcjS00',
    name: 'Eternity — Lifetime',
    nameBg: 'Вечност — Еднократно',
    amount: '€499',
    interval: '',
    isSubscription: false,
  },
  gift_premium_year: {
    url: 'https://buy.stripe.com/00w5kw1ewgff5KncH5cjS01',
    name: 'Gift — 1 Year Legacy',
    nameBg: 'Подарък — 1 год. Legacy',
    amount: '€249',
    interval: '',
    isSubscription: true,
  },
  gift_lifetime: {
    url: 'https://buy.stripe.com/cNi3coe1ie777Sv5eDcjS00',
    name: 'Gift — Eternity',
    nameBg: 'Подарък — Вечност',
    amount: '€499',
    interval: '',
    isSubscription: false,
  },
};

function CheckoutContent() {
  const { locale } = useLang();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan') || 'premium_monthly';
  const recipientName  = searchParams.get('recipientName') || '';
  const senderName     = searchParams.get('senderName') || '';
  const message        = searchParams.get('message') || '';

  const isGift = plan.startsWith('gift_');
  const planInfo = PAYMENT_LINKS[plan];

  const displayName   = locale === 'bg' ? planInfo?.nameBg : planInfo?.name;
  const displayAmount = planInfo ? `${planInfo.amount}${planInfo.interval}` : '';

  // Build the Stripe payment link — append prefilled_email if available
  const stripeUrl = planInfo?.url || 'https://buy.stripe.com/aFa9AMaP65ABb4H0YncjS02';

  if (!planInfo) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">{locale === 'bg' ? 'Непознат план' : 'Unknown plan'}</p>
          <Link href="/pricing" className="text-brand-600 underline mt-2 block">
            {locale === 'bg' ? '← Обратно към цени' : '← Back to Pricing'}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-50 to-white pt-24 pb-20">
      <div className="max-w-lg mx-auto px-4">

        {/* Back link */}
        <Link href="/pricing" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-600 mb-8">
          ← {locale === 'bg' ? 'Обратно към цени' : 'Back to Pricing'}
        </Link>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {locale === 'bg' ? 'Завърши покупката' : 'Complete your purchase'}
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            {locale === 'bg'
              ? 'Ще бъдеш пренасочен към Stripe — сигурна платформа за плащане.'
              : 'You will be redirected to Stripe — the secure payment platform.'}
          </p>

          {/* Plan summary */}
          <div className="bg-brand-50 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div>
              <div className="font-bold text-gray-900 text-lg">{displayName}</div>
              {planInfo.isSubscription && (
                <div className="text-xs text-gray-400 mt-0.5">
                  {locale === 'bg' ? 'Абонамент — анулиране по всяко време' : 'Subscription — cancel anytime'}
                </div>
              )}
              {!planInfo.isSubscription && (
                <div className="text-xs text-gray-400 mt-0.5">
                  {locale === 'bg' ? 'Еднократно плащане — без абонамент' : 'One-time payment — no subscription'}
                </div>
              )}
              {isGift && recipientName && (
                <div className="text-sm text-brand-600 font-medium mt-1">
                  {locale === 'bg' ? `🎁 Получател: ${recipientName}` : `🎁 For: ${recipientName}`}
                </div>
              )}
              {isGift && senderName && (
                <div className="text-xs text-gray-400 mt-0.5">
                  {locale === 'bg' ? `От: ${senderName}` : `From: ${senderName}`}
                </div>
              )}
            </div>
            <div className="text-3xl font-extrabold text-brand-700 whitespace-nowrap">{displayAmount}</div>
          </div>

          {/* Gift message preview */}
          {isGift && message && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6">
              <div className="text-xs font-semibold text-amber-700 mb-1">
                {locale === 'bg' ? '💌 Лично съобщение:' : '💌 Personal message:'}
              </div>
              <div className="text-sm text-amber-900 italic">"{message}"</div>
            </div>
          )}

          {/* CTA — direct Stripe link */}
          <a
            href={stripeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center font-body font-bold py-4 rounded-full transition-all hover:scale-105 text-base mb-4" style={{backgroundColor:'hsl(36 80% 55%)',color:'hsl(30 15% 7%)'}}
          >
            🔒 {locale === 'bg' ? 'Плати сигурно чрез Stripe' : 'Pay securely with Stripe'}
          </a>

          {/* 30-day guarantee */}
          <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex items-center justify-center gap-2 mb-4">
            <span className="text-green-600 text-base">🛡️</span>
            <span className="text-green-800 text-xs font-semibold">
              {locale === 'bg' ? '30-дневна гаранция за връщане на парите' : '30-day money-back guarantee'}
            </span>
          </div>

          <p className="text-center text-xs text-gray-400">
            {locale === 'bg'
              ? 'Плащането се обработва от Stripe. Ние не съхраняваме данни за карти.'
              : 'Payments processed by Stripe. We never store card details.'}
          </p>
        </div>

        {/* Trust signals */}
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <div className="bg-white border border-gray-100 rounded-xl p-3">
            <div className="text-xl mb-1">🔒</div>
            <div className="text-xs text-gray-500 font-medium">SSL Encrypted</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-3">
            <div className="text-xl mb-1">💳</div>
            <div className="text-xs text-gray-500 font-medium">Stripe Secure</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-3">
            <div className="text-xl mb-1">🛡️</div>
            <div className="text-xs text-gray-500 font-medium">
              {locale === 'bg' ? 'Данните ви са ваши' : 'Your data, your rights'}
            </div>
          </div>
        </div>

        {/* Footer links */}
        <div className="mt-4 text-center">
          <Link href="/terms" className="text-xs text-gray-400 hover:text-gray-600 underline">
            {locale === 'bg' ? 'Общи условия' : 'Terms of Service'}
          </Link>
          <span className="text-gray-300 mx-2">·</span>
          <Link href="/privacy" className="text-xs text-gray-400 hover:text-gray-600 underline">
            {locale === 'bg' ? 'Поверителност' : 'Privacy Policy'}
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
