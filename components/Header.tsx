'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLang } from './LangContext';
import type { Locale } from '@/dictionaries';

export default function Header() {
  const { dict, locale, setLocale } = useLang();
  const h = dict.header;
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItems = [
    { key: 'experience', href: '/experience' },
    { key: 'waitlist',   href: '/waitlist' },
    { key: 'demo',       href: '/demo' },
    { key: 'safety',     href: '/safety' },
    { key: 'contact',    href: '/contact' },
  ] as const;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-sm shadow-sm' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-18">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0 font-bold text-xl text-brand-700 tracking-tight">
            {h.logo}
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
            {navItems.map((item) => {
              const navItem = h.nav[item.key];
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="group flex flex-col items-center text-center hover:text-brand-600 transition-colors"
                >
                  <span className="text-[15px] font-semibold text-gray-800 group-hover:text-brand-600 leading-tight whitespace-nowrap">
                    {navItem.label}
                  </span>
                  <span className="nav-sublabel text-gray-500 group-hover:text-brand-400">
                    {navItem.sub}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Right: lang switch + login + CTA */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Language switch */}
            <div className="flex items-center gap-1 text-sm font-medium text-gray-500">
              <button
                onClick={() => setLocale('en')}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  locale === 'en' ? 'text-brand-700 font-bold' : 'hover:text-brand-600'
                }`}
              >EN</button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => setLocale('bg')}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  locale === 'bg' ? 'text-brand-700 font-bold' : 'hover:text-brand-600'
                }`}
              >BG</button>
            </div>
            <Link
              href="/login"
              className="text-sm font-semibold text-gray-700 hover:text-brand-600 transition-colors px-3 py-2"
            >
              {h.login}
            </Link>
            <Link
              href="/waitlist"
              className="bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors shadow-sm"
            >
              {h.joinWaitlist}
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 rounded-md text-gray-700 hover:text-brand-600 hover:bg-gray-100"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-gray-100 shadow-lg">
          <nav className="px-4 py-4 flex flex-col gap-1">
            {navItems.map((item) => {
              const navItem = h.nav[item.key];
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex flex-col py-3 border-b border-gray-50"
                >
                  <span className="text-[15px] font-semibold text-gray-800">{navItem.label}</span>
                  <span className="text-xs text-gray-400 mt-0.5">{navItem.sub}</span>
                </Link>
              );
            })}
            <div className="flex items-center gap-4 pt-4">
              <div className="flex items-center gap-1 text-sm font-medium text-gray-500">
                <button onClick={() => { setLocale('en'); setMobileOpen(false); }}
                  className={locale === 'en' ? 'text-brand-700 font-bold' : ''}>EN</button>
                <span>|</span>
                <button onClick={() => { setLocale('bg'); setMobileOpen(false); }}
                  className={locale === 'bg' ? 'text-brand-700 font-bold' : ''}>BG</button>
              </div>
              <Link href="/login" onClick={() => setMobileOpen(false)}
                className="text-sm font-semibold text-gray-700">{h.login}</Link>
              <Link href="/waitlist" onClick={() => setMobileOpen(false)}
                className="ml-auto bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                {h.joinWaitlist}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
