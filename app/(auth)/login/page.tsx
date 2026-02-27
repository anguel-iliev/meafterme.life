'use client';
import React, { useState } from 'react';
import { useLang } from '@/components/LangContext';

export default function LoginPage() {
  const { dict } = useLang();
  const l = dict.login;
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [demoLink, setDemoLink] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setDemoLink(null);
    try {
      const res = await fetch('/api/auth/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error sending link');

      if (data.demo && data.link) {
        // Demo mode — show clickable link directly
        setDemoLink(data.link);
      } else {
        setSent(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Production: email sent confirmation
  if (sent) {
    return (
      <div className="max-w-md mx-auto px-4 sm:px-6 py-20 text-center">
        <div className="text-5xl mb-6">📬</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">{l.sentTitle}</h2>
        <p className="text-gray-600">{l.sentCopy.replace('{email}', email)}</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-20">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{l.title}</h1>
        <p className="text-gray-500 text-sm">{l.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder={l.emailPlaceholder}
          className="w-full border border-gray-300 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-600 text-white font-bold py-3.5 rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-60"
        >
          {loading ? '…' : l.submit}
        </button>
      </form>

      {/* Demo mode — show direct sign-in link */}
      {demoLink && (
        <div className="mt-6 p-5 bg-amber-50 border border-amber-200 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🔑</span>
            <p className="text-sm font-bold text-amber-800">Demo mode — click to sign in instantly</p>
          </div>
          <p className="text-xs text-amber-700 mb-4">
            No email needed in demo mode. Click the button below to sign in as <strong>{email}</strong>.
          </p>
          <a
            href={demoLink}
            className="block w-full text-center bg-amber-500 text-white font-bold py-3 rounded-xl hover:bg-amber-600 transition-colors text-sm"
          >
            ✓ Sign in to MEafterMe →
          </a>
        </div>
      )}

      {/* Demo hint */}
      <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-xl">
        <p className="text-xs text-gray-500 text-center">
          <span className="font-semibold text-gray-700">Demo mode active</span> — enter any email address to get instant access. No Firebase or SMTP needed.
        </p>
      </div>
    </div>
  );
}
