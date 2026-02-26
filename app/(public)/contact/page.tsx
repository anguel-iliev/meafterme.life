'use client';
import React, { useState } from 'react';
import { useLang } from '@/components/LangContext';

export default function ContactPage() {
  const { dict } = useLang();
  const c = dict.contact;
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', message: '', earlyAccess: false });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) setSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <div className="text-5xl mb-6">✉️</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">{c.successTitle}</h2>
        <p className="text-gray-600">{c.successCopy}</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{c.title}</h1>
      <p className="text-gray-500 mb-10">{c.subtitle}</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{c.namePlaceholder}</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder={c.namePlaceholder}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{c.emailPlaceholder}</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder={c.emailPlaceholder}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{c.messagePlaceholder}</label>
          <textarea
            required
            rows={5}
            value={form.message}
            onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
            placeholder={c.messagePlaceholder}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent resize-none"
          />
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.earlyAccess}
            onChange={e => setForm(f => ({ ...f, earlyAccess: e.target.checked }))}
            className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-400"
          />
          <span className="text-sm text-gray-700">{c.earlyAccess}</span>
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-600 text-white font-bold py-3.5 rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-60"
        >
          {loading ? '…' : c.send}
        </button>
      </form>
    </div>
  );
}
