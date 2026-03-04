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
    { key: 'pricing',    href: '/pricing' },
    { key: 'gift',       href: '/gift' },
    { key: 'demo',       href: '/demo' },
    { key: 'safety',     href: '/safety' },
    { key: 'contact',    href: '/contact' },
  ] as const;

  const headerBg = scrolled
    ? 'hsl(30 15% 7% / 0.95)'
    : 'transparent';
  const headerBorder = scrolled
    ? '1px solid hsl(30 10% 18%)'
    : '1px solid transparent';

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{ backgroundColor: headerBg, borderBottom: headerBorder, backdropFilter: scrolled ? 'blur(8px)' : 'none' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex-shrink-0 font-display font-bold text-xl tracking-tight"
                style={{ color: 'hsl(38 50% 92%)' }}>
            <span style={{ color: 'hsl(36 80% 55%)' }}>ME</span>afterMe
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
            {navItems.map((item) => {
              const navItem = (h.nav as Record<string, { label: string; sub: string }>)[item.key];
              if (!navItem) return null;
              return (
                <Link key={item.key} href={item.href}
                  className="group flex flex-col items-center text-center transition-colors duration-200">
                  <span className="text-[14px] font-body font-medium leading-tight whitespace-nowrap transition-colors"
                        style={{ color: 'hsl(38 50% 92% / 0.8)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'hsl(36 80% 55%)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'hsl(38 50% 92% / 0.8)')}>
                    {navItem.label}
                  </span>
                  <span className="text-[11px] leading-tight transition-colors"
                        style={{ color: 'hsl(38 50% 92% / 0.4)' }}>
                    {navItem.sub}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Right: lang + CTA buttons */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Language toggle */}
            <div className="flex items-center gap-1 font-body text-sm font-medium"
                 style={{ color: 'hsl(38 50% 92% / 0.5)' }}>
              <button
                onClick={() => setLocale('en')}
                className="px-1.5 py-0.5 rounded transition-colors"
                style={{ color: locale === 'en' ? 'hsl(36 80% 55%)' : 'hsl(38 50% 92% / 0.5)', fontWeight: locale === 'en' ? '700' : '500' }}>
                EN
              </button>
              <span style={{ color: 'hsl(30 10% 18%)' }}>|</span>
              <button
                onClick={() => setLocale('bg')}
                className="px-1.5 py-0.5 rounded transition-colors"
                style={{ color: locale === 'bg' ? 'hsl(36 80% 55%)' : 'hsl(38 50% 92% / 0.5)', fontWeight: locale === 'bg' ? '700' : '500' }}>
                BG
              </button>
            </div>

            {/* Login link */}
            <Link href="/login"
              className="font-body text-sm font-medium transition-colors px-3 py-2 rounded-lg"
              style={{ color: 'hsl(38 50% 92% / 0.8)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'hsl(38 50% 92%)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'hsl(38 50% 92% / 0.8)')}>
              {h.login}
            </Link>

            {/* CTA button */}
            <Link href="/login"
              className="font-body text-sm font-semibold px-5 py-2.5 rounded-full transition-all duration-200 hover:scale-105"
              style={{ backgroundColor: 'hsl(36 80% 55%)', color: 'hsl(30 15% 7%)' }}>
              {locale === 'bg' ? 'Започни безплатно' : 'Start for free'}
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 rounded-md transition-colors"
            style={{ color: 'hsl(38 50% 92% / 0.8)' }}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden"
             style={{ backgroundColor: 'hsl(30 12% 11%)', borderTop: '1px solid hsl(30 10% 18%)' }}>
          <nav className="px-4 py-4 flex flex-col gap-1">
            {navItems.map((item) => {
              const navItem = (h.nav as Record<string, { label: string; sub: string }>)[item.key];
              if (!navItem) return null;
              return (
                <Link key={item.key} href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex flex-col py-3"
                  style={{ borderBottom: '1px solid hsl(30 10% 18%)' }}>
                  <span className="font-body text-[15px] font-medium"
                        style={{ color: 'hsl(38 50% 92%)' }}>
                    {navItem.label}
                  </span>
                  <span className="font-body text-xs mt-0.5"
                        style={{ color: 'hsl(38 50% 92% / 0.4)' }}>
                    {navItem.sub}
                  </span>
                </Link>
              );
            })}
            <div className="flex items-center gap-4 pt-4">
              <div className="flex items-center gap-1 font-body text-sm font-medium"
                   style={{ color: 'hsl(38 50% 92% / 0.5)' }}>
                <button
                  onClick={() => { setLocale('en'); setMobileOpen(false); }}
                  style={{ color: locale === 'en' ? 'hsl(36 80% 55%)' : undefined, fontWeight: locale === 'en' ? '700' : undefined }}>
                  EN
                </button>
                <span>|</span>
                <button
                  onClick={() => { setLocale('bg'); setMobileOpen(false); }}
                  style={{ color: locale === 'bg' ? 'hsl(36 80% 55%)' : undefined, fontWeight: locale === 'bg' ? '700' : undefined }}>
                  BG
                </button>
              </div>
              <Link href="/login" onClick={() => setMobileOpen(false)}
                className="ml-auto font-body text-sm font-semibold px-5 py-2 rounded-full"
                style={{ backgroundColor: 'hsl(36 80% 55%)', color: 'hsl(30 15% 7%)' }}>
                {locale === 'bg' ? 'Започни' : 'Start free'}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
