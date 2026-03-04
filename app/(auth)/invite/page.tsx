'use client';
import React, { useState } from 'react';
import { useLang } from '@/components/LangContext';
import { useRouter } from 'next/navigation';
import { redeemInviteCode, getCurrentUser } from '@/lib/clientStore';

export default function InvitePage() {
  const { dict } = useLang();
  const inv = dict.invite;
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = getCurrentUser();
      const email = user?.email || 'demo@afterme.life';
      const result = await redeemInviteCode(code, email);
      if (result === 'ok') {
        router.push('/pending/');
      } else if (result === 'used') {
        setError('This invite code has already been used.');
      } else {
        setError(inv.invalid || 'Invalid invite code.');
      }
    } catch (err: any) {
      setError(err.message || 'Error redeeming code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-20">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{inv.title}</h1>
        <p className="text-gray-500 text-sm">{inv.subtitle}</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          required
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder={inv.codePlaceholder}
          className="w-full border border-gray-300 rounded-xl px-4 py-3.5 text-base text-center font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent uppercase"
          maxLength={12}
        />
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        <button
          type="submit"
          disabled={loading || code.length < 4}
          className="w-full bg-brand-600 text-white font-bold py-3.5 rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-60"
        >
          {loading ? '…' : inv.submit}
        </button>
      </form>
      <p className="text-center text-xs text-gray-400 mt-6">
        Demo code: <strong className="font-mono">DEMO2026</strong>
      </p>
    </div>
  );
}
