'use client';
import { useLang } from '@/components/LangContext';

export default function SafetyPage() {
  const { dict } = useLang();
  const s = dict.safety;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-10">{s.title}</h1>
      <div className="space-y-8">
        {s.sections.map((section) => (
          <div key={section.title} className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-3">{section.title}</h2>
            <p className="text-gray-700 leading-relaxed">{section.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 bg-brand-50 border border-brand-100 rounded-2xl p-8">
        <h3 className="font-bold text-brand-800 mb-2">Questions about consent or data?</h3>
        <p className="text-brand-700 text-sm">
          Contact us at{' '}
          <a href="mailto:privacy@afterme.life" className="underline hover:no-underline">
            privacy@afterme.life
          </a>
          . We will respond within 5 business days.
        </p>
      </div>
    </div>
  );
}
