'use client';
import React, { useState } from 'react';
import { useLang } from '@/components/LangContext';
import { submitContactForm } from '@/lib/clientStore';

const darkStyle = { backgroundColor: 'hsl(30 15% 7%)', color: 'hsl(38 50% 92%)' };
const amber = 'hsl(36 80% 55%)';
const cream = 'hsl(38 50% 92%)';
const dimmed = 'hsl(38 50% 92% / 0.6)';

const inputStyle = {
  backgroundColor: 'hsl(30 12% 11%)',
  border: '1px solid hsl(30 10% 18%)',
  color: cream,
  outline: 'none',
};

export default function ContactPage() {
  const { dict, locale } = useLang();
  const c = dict.contact;
  const isBg = locale === 'bg';
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', message: '', earlyAccess: false });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await submitContactForm(form);
      setSent(true);
    } catch (err) {
      console.error(err);
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div style={darkStyle} className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-6xl mb-6">✉️</div>
          <h2 className="font-display text-2xl font-bold mb-3" style={{ color: cream }}>{c.successTitle}</h2>
          <p className="font-body" style={{ color: dimmed }}>{c.successCopy}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={darkStyle} className="min-h-screen">
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="mb-12">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-body font-medium tracking-widest uppercase mb-6"
                style={{ backgroundColor: 'hsl(36 80% 55% / 0.1)', color: amber, border: '1px solid hsl(36 80% 55% / 0.2)' }}>
            📬 {isBg ? 'Свържете се с нас' : 'Get in touch'}
          </span>
          <h1 className="font-display text-3xl font-bold mb-2" style={{ color: cream }}>{c.title}</h1>
          <p className="font-body" style={{ color: dimmed }}>{c.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block font-body text-sm font-medium mb-1.5" style={{ color: 'hsl(38 50% 92% / 0.8)' }}>
              {c.namePlaceholder}
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={c.namePlaceholder}
              className="w-full rounded-xl px-4 py-3 font-body text-sm focus:ring-2 transition-all"
              style={{ ...inputStyle, boxShadow: 'none' }}
              onFocus={e => (e.currentTarget.style.border = `1px solid ${amber}`)}
              onBlur={e => (e.currentTarget.style.border = '1px solid hsl(30 10% 18%)')}
            />
          </div>
          <div>
            <label className="block font-body text-sm font-medium mb-1.5" style={{ color: 'hsl(38 50% 92% / 0.8)' }}>
              {c.emailPlaceholder}
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder={c.emailPlaceholder}
              className="w-full rounded-xl px-4 py-3 font-body text-sm transition-all"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.border = `1px solid ${amber}`)}
              onBlur={e => (e.currentTarget.style.border = '1px solid hsl(30 10% 18%)')}
            />
          </div>
          <div>
            <label className="block font-body text-sm font-medium mb-1.5" style={{ color: 'hsl(38 50% 92% / 0.8)' }}>
              {c.messagePlaceholder}
            </label>
            <textarea
              required
              rows={5}
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder={c.messagePlaceholder}
              className="w-full rounded-xl px-4 py-3 font-body text-sm resize-none transition-all"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.border = `1px solid ${amber}`)}
              onBlur={e => (e.currentTarget.style.border = '1px solid hsl(30 10% 18%)')}
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.earlyAccess}
              onChange={e => setForm(f => ({ ...f, earlyAccess: e.target.checked }))}
              className="w-4 h-4 rounded"
              style={{ accentColor: amber }}
            />
            <span className="font-body text-sm" style={{ color: dimmed }}>{c.earlyAccess}</span>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full font-body font-bold py-3.5 rounded-full transition-all hover:scale-105 disabled:opacity-60"
            style={{ backgroundColor: amber, color: 'hsl(30 15% 7%)' }}
          >
            {loading ? '…' : c.send}
          </button>
        </form>
      </div>
    </div>
  );
}
