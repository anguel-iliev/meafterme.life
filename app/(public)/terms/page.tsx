'use client';
import { useLang } from '@/components/LangContext';

export default function TermsPage() {
  const { dict } = useLang();
  const t = dict.terms;
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">{t.title}</h1>
      <div className="prose prose-gray max-w-none">
        <p className="text-gray-600 text-lg">{t.copy}</p>
        <p className="text-gray-500 text-sm mt-8">Last updated: February 2026 — Full terms coming soon.</p>
      </div>
    </div>
  );
}
