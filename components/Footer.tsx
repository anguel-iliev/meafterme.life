'use client';
import Link from 'next/link';
import { useLang } from './LangContext';

export default function Footer() {
  const { dict } = useLang();
  const f = dict.footer;
  return (
    <footer className="bg-gray-900 text-gray-400 py-10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm">{f.copy}</p>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/privacy" className="hover:text-white transition-colors">{f.links.privacy}</Link>
          <Link href="/terms"   className="hover:text-white transition-colors">{f.links.terms}</Link>
          <Link href="/contact" className="hover:text-white transition-colors">{f.links.contact}</Link>
        </div>
      </div>
    </footer>
  );
}
