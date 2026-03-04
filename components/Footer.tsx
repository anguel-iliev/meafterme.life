'use client';
import Link from 'next/link';
import { useLang } from './LangContext';

export default function Footer() {
  const { dict, locale } = useLang();
  const f = dict.footer;
  const isBg = locale === 'bg';

  return (
    <footer style={{ backgroundColor: 'hsl(30 12% 11%)', borderTop: '1px solid hsl(30 10% 18%)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid sm:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="sm:col-span-2">
            <div className="font-display font-bold text-2xl mb-3"
                 style={{ color: 'hsl(38 50% 92%)' }}>
              <span style={{ color: 'hsl(36 80% 55%)' }}>ME</span>afterMe
            </div>
            <p className="font-body text-sm leading-relaxed max-w-xs"
               style={{ color: 'hsl(38 50% 92% / 0.5)' }}>
              {isBg
                ? 'MEafterMe помага на хората да съхранят историята на живота си — с техния собствен глас и думи.'
                : 'MEafterMe helps people preserve their life stories — in their own voice and words.'}
            </p>
          </div>

          {/* Pages */}
          <div>
            <h4 className="font-body font-semibold text-sm mb-4 uppercase tracking-widest"
                style={{ color: 'hsl(36 80% 55%)' }}>
              {isBg ? 'Страници' : 'Pages'}
            </h4>
            <ul className="space-y-2">
              {[
                { href: '/experience', label: isBg ? 'Опит' : 'Experience' },
                { href: '/pricing',    label: isBg ? 'Цени' : 'Pricing' },
                { href: '/gift',       label: isBg ? 'Подари' : 'Gift' },
                { href: '/demo',       label: 'Demo' },
              ].map(link => (
                <li key={link.href}>
                  <Link href={link.href}
                    className="font-body text-sm transition-colors"
                    style={{ color: 'hsl(38 50% 92% / 0.5)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'hsl(36 80% 55%)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'hsl(38 50% 92% / 0.5)')}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-body font-semibold text-sm mb-4 uppercase tracking-widest"
                style={{ color: 'hsl(36 80% 55%)' }}>
              {isBg ? 'Правни' : 'Legal'}
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/privacy"
                  className="font-body text-sm transition-colors"
                  style={{ color: 'hsl(38 50% 92% / 0.5)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'hsl(36 80% 55%)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'hsl(38 50% 92% / 0.5)')}>
                  {f.links.privacy}
                </Link>
              </li>
              <li>
                <Link href="/terms"
                  className="font-body text-sm transition-colors"
                  style={{ color: 'hsl(38 50% 92% / 0.5)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'hsl(36 80% 55%)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'hsl(38 50% 92% / 0.5)')}>
                  {f.links.terms}
                </Link>
              </li>
              <li>
                <Link href="/safety"
                  className="font-body text-sm transition-colors"
                  style={{ color: 'hsl(38 50% 92% / 0.5)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'hsl(36 80% 55%)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'hsl(38 50% 92% / 0.5)')}>
                  {isBg ? 'Сигурност' : 'Safety'}
                </Link>
              </li>
              <li>
                <Link href="/contact"
                  className="font-body text-sm transition-colors"
                  style={{ color: 'hsl(38 50% 92% / 0.5)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'hsl(36 80% 55%)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'hsl(38 50% 92% / 0.5)')}>
                  {f.links.contact}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
             style={{ borderTop: '1px solid hsl(30 10% 18%)' }}>
          <p className="font-body text-sm" style={{ color: 'hsl(38 50% 92% / 0.4)' }}>
            {f.copy}
          </p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse"
                 style={{ backgroundColor: 'hsl(142 70% 50%)' }} />
            <span className="font-body text-xs" style={{ color: 'hsl(38 50% 92% / 0.4)' }}>
              {isBg ? 'Системата работи нормално' : 'All systems operational'}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
