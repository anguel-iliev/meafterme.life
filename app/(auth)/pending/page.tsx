'use client';
import { useLang } from '@/components/LangContext';
import Link from 'next/link';

export default function PendingPage() {
  const { dict } = useLang();
  const p = dict.pending;
  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-24 text-center">
      <div className="text-5xl mb-6">⏳</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">{p.title}</h1>
      <p className="text-gray-600 mb-4">{p.subtitle}</p>
      <p className="text-gray-500 text-sm mb-8">{p.copy}</p>
      <Link href="/" className="text-brand-600 font-medium hover:underline text-sm">
        ← Back to homepage
      </Link>
    </div>
  );
}
