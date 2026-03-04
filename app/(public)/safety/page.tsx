'use client';
import { useLang } from '@/components/LangContext';

const darkStyle = { backgroundColor: 'hsl(30 15% 7%)', color: 'hsl(38 50% 92%)' };
const cardStyle = { background: 'linear-gradient(135deg, hsl(30 12% 11%) 0%, hsl(30 10% 14%) 100%)', border: '1px solid hsl(30 10% 18%)', boxShadow: '0 8px 32px -8px hsl(0 0% 0% / 0.4)' };
const amber = 'hsl(36 80% 55%)';
const cream = 'hsl(38 50% 92%)';
const dimmed = 'hsl(38 50% 92% / 0.6)';

export default function SafetyPage() {
  const { dict, locale } = useLang();
  const s = dict.safety;
  const isBg = locale === 'bg';

  return (
    <div style={darkStyle} className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="mb-12">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-body font-medium tracking-widest uppercase mb-6"
                style={{ backgroundColor: 'hsl(36 80% 55% / 0.1)', color: amber, border: '1px solid hsl(36 80% 55% / 0.2)' }}>
            🔒 {isBg ? 'Сигурност и съгласие' : 'Safety & Consent'}
          </span>
          <h1 className="font-display text-4xl font-bold mb-4" style={{ color: cream }}>{s.title}</h1>
        </div>

        <div className="space-y-6">
          {s.sections.map((section, i) => (
            <div key={section.title} className="p-8 rounded-2xl" style={cardStyle}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-body font-bold text-sm"
                     style={{ backgroundColor: 'hsl(36 80% 55% / 0.15)', color: amber }}>
                  {i + 1}
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold mb-3" style={{ color: cream }}>
                    {section.title}
                  </h2>
                  <p className="font-body leading-relaxed" style={{ color: dimmed }}>
                    {section.body}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Contact card */}
        <div className="mt-10 p-8 rounded-2xl" style={{ ...cardStyle, border: '1px solid hsl(36 80% 55% / 0.3)' }}>
          <h3 className="font-display font-bold mb-2" style={{ color: amber }}>
            {isBg ? 'Въпроси относно съгласието или данните?' : 'Questions about consent or data?'}
          </h3>
          <p className="font-body text-sm" style={{ color: dimmed }}>
            {isBg ? 'Свържете се с нас на ' : 'Contact us at '}
            <a href="mailto:privacy@afterme.life" className="underline hover:no-underline" style={{ color: amber }}>
              privacy@afterme.life
            </a>
            {isBg ? '. Ще отговорим в рамките на 5 работни дни.' : '. We will respond within 5 business days.'}
          </p>
        </div>
      </div>
    </div>
  );
}
