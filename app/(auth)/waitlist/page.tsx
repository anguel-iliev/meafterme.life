'use client';
import React, { useState } from 'react';
import { useLang } from '@/components/LangContext';
import Link from 'next/link';

export default function WaitlistPage() {
  const { dict } = useLang();
  const w = dict.waitlist;
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<'new' | 'existing' | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setResult(data.result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (result === 'new') {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="text-5xl mb-6">🎉</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">{w.statusTitle}</h2>
        <p className="text-gray-600 mb-8">{w.statusCopy}</p>
        <ol className="text-left space-y-3 bg-brand-50 border border-brand-100 rounded-2xl p-6">
          {w.nextSteps.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-brand-800">
              <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex-shrink-0 flex items-center justify-center">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (result === 'existing') {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="text-5xl mb-6">📮</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">{w.alreadyTitle}</h2>
        <p className="text-gray-600 mb-8">{w.alreadyCopy}</p>
        <Link href="/invite" className="inline-block bg-brand-600 text-white font-bold px-7 py-3 rounded-xl hover:bg-brand-700 transition-colors">
          Enter invite code →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-block bg-brand-600 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-4 uppercase tracking-wide">
          Private Beta
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">{w.title}</h1>
        <p className="text-gray-500">{w.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder={w.emailPlaceholder}
          className="w-full border border-gray-300 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-600 text-white font-bold py-3.5 rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-60 text-base"
        >
          {loading ? '…' : w.submit}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Already have an invite code?{' '}
        <Link href="/invite" className="text-brand-600 font-medium hover:underline">Enter it here</Link>
      </p>
    </div>
  );
}
