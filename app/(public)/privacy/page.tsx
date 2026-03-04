'use client';
import { useLang } from '@/components/LangContext';

const darkStyle = { backgroundColor: 'hsl(30 15% 7%)', color: 'hsl(38 50% 92%)' };
const amber = 'hsl(36 80% 55%)';
const cream = 'hsl(38 50% 92%)';
const dimmed = 'hsl(38 50% 92% / 0.6)';

export default function PrivacyPage() {
  const { dict, locale } = useLang();
  const p = dict.privacy;
  const isBg = locale === 'bg';

  return (
    <div style={darkStyle} className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-body font-medium tracking-widest uppercase mb-6"
                style={{ backgroundColor: 'hsl(36 80% 55% / 0.1)', color: amber, border: '1px solid hsl(36 80% 55% / 0.2)' }}>
            🔐 {isBg ? 'Поверителност' : 'Privacy'}
          </span>
          <h1 className="font-display text-4xl font-bold mb-4" style={{ color: cream }}>{p.title}</h1>
          <p className="font-body text-lg leading-relaxed" style={{ color: dimmed }}>{p.copy}</p>
        </div>
        <div className="p-6 rounded-2xl" style={{ background: 'linear-gradient(135deg, hsl(30 12% 11%) 0%, hsl(30 10% 14%) 100%)', border: '1px solid hsl(30 10% 18%)' }}>
          <p className="font-body text-sm" style={{ color: 'hsl(38 50% 92% / 0.4)' }}>
            {isBg ? 'Последно актуализирано: Февруари 2026 — Пълна политика очаква се скоро.' : 'Last updated: February 2026 — Full policy coming soon.'}
          </p>
        </div>
      </div>
    </div>
  );
}
