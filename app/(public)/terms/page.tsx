'use client';
import React from 'react';
import Link from 'next/link';
import { useLang } from '@/components/LangContext';

const darkStyle = { backgroundColor: 'hsl(30 15% 7%)', color: 'hsl(38 50% 92%)' };
const cardStyle = { background: 'linear-gradient(135deg, hsl(30 12% 11%) 0%, hsl(30 10% 14%) 100%)', border: '1px solid hsl(30 10% 18%)' };
const amber = 'hsl(36 80% 55%)';
const cream = 'hsl(38 50% 92%)';
const dimmed = 'hsl(38 50% 92% / 0.6)';

export default function TermsPage() {
  const { locale } = useLang();
  const isBg = locale === 'bg';

  const sections = isBg ? [
    { title: '1. Приемане на условията', body: 'Като използвате MEafterMe, вие се съгласявате с настоящите Общи условия. Ако не сте съгласни с тях, моля не използвайте платформата.', highlight: false },
    { title: '2. Вашите данни принадлежат на вас', body: 'MEafterMe не претендира за никакви права върху съдържанието, което качвате — снимки, видеа, документи, отговори на въпроси или всякакви други материали. Вие запазвате пълното авторско право и собственост върху всичко, което сте създали.', highlight: true },
    { title: '3. Поверителност и сигурност', body: 'Всички данни се съхраняват криптирани на инфраструктурата на Google Cloud (Firebase). Ние не продаваме, не споделяме и не предоставяме вашите лични данни на трети страни с рекламни или търговски цели.', highlight: false },
    { title: '4. Право на изтриване', body: 'По всяко време можете да поискате пълното изтриване на вашия профил и всички свързани данни. При изпращане на заявка до contact@afterme.life изтриването се извършва в рамките на 30 дни.', highlight: false },
    { title: '5. Планове и плащания', body: 'Безплатният план включва ограничени функции без таксуване. Платените планове се таксуват съгласно избрания период. При месечен и годишен абонамент можете да анулирате по всяко време. Предлагаме 30-дневна гаранция за връщане на парите.', highlight: false },
    { title: '6. Достъп от наследници', body: 'Функцията „Наследници" позволява на потребителите да предоставят достъп до своя профил на доверени лица след своята смърт. MEafterMe не носи отговорност за спорове относно наследяването на цифрово съдържание.', highlight: false },
    { title: '7. Забранено съдържание', body: 'Забранено е качването на съдържание, което нарушава авторски права на трети страни, съдържа незаконни материали или е предназначено да навреди на другите.', highlight: false },
    { title: '8. Промени в условията', body: 'При съществени промени в условията ще уведомим потребителите по имейл минимум 30 дни предварително.', highlight: false },
    { title: '9. Контакт', body: 'При въпроси относно тези условия: contact@afterme.life | afterme.life', highlight: false },
  ] : [
    { title: '1. Acceptance of Terms', body: 'By using MEafterMe, you agree to these Terms of Service. If you do not agree, please do not use the platform.', highlight: false },
    { title: '2. Your Data Belongs to You', body: 'MEafterMe makes no claim to any rights over the content you upload — photos, videos, documents, question answers, or any other materials. You retain full copyright and ownership of everything you have created.', highlight: true },
    { title: '3. Privacy and Security', body: 'All data is stored encrypted on Google Cloud (Firebase) infrastructure. We do not sell, share, or provide your personal data to third parties for advertising or commercial purposes.', highlight: false },
    { title: '4. Right to Deletion', body: 'At any time you may request full deletion of your profile and all associated data. Upon submitting a request to contact@afterme.life, deletion is completed within 30 days.', highlight: false },
    { title: '5. Plans and Payments', body: 'The Free plan includes limited features with no charge. Paid plans are billed according to the selected period. For monthly and yearly subscriptions you may cancel at any time. We offer a 30-day money-back guarantee.', highlight: false },
    { title: '6. Heir Access', body: 'The "Heirs" feature allows users to grant access to their profile to trusted individuals after their passing. MEafterMe is not responsible for disputes regarding the inheritance of digital content.', highlight: false },
    { title: '7. Prohibited Content', body: 'It is prohibited to upload content that infringes third-party copyrights, contains illegal material, or is intended to harm others.', highlight: false },
    { title: '8. Changes to Terms', body: 'For material changes to these terms, we will notify users by email at least 30 days in advance.', highlight: false },
    { title: '9. Contact', body: 'For questions about these terms: contact@afterme.life | afterme.life', highlight: false },
  ];

  return (
    <main style={darkStyle} className="min-h-screen pt-8 pb-20">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="mb-10">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-body font-medium tracking-widest uppercase mb-6"
                style={{ backgroundColor: 'hsl(36 80% 55% / 0.1)', color: amber, border: '1px solid hsl(36 80% 55% / 0.2)' }}>
            📄 {isBg ? 'Правен документ' : 'Legal document'}
          </span>
          <h1 className="font-display text-4xl font-bold text-cream mb-3" style={{ color: cream }}>
            {isBg ? 'Общи условия' : 'Terms of Service'}
          </h1>
          <p className="font-body text-sm" style={{ color: 'hsl(38 50% 92% / 0.4)' }}>
            {isBg ? 'Последна актуализация: Февруари 2026' : 'Last updated: February 2026'}
          </p>
        </div>

        {/* Key promise banner */}
        <div className="p-6 mb-8 flex gap-4 rounded-2xl" style={{ backgroundColor: 'hsl(36 80% 55% / 0.08)', border: '1px solid hsl(36 80% 55% / 0.3)' }}>
          <div className="text-3xl flex-shrink-0">🔑</div>
          <div>
            <div className="font-display font-bold mb-1" style={{ color: amber }}>
              {isBg ? 'Основен принцип: Данните ви принадлежат на вас' : 'Core principle: Your data belongs to you'}
            </div>
            <p className="font-body text-sm leading-relaxed" style={{ color: dimmed }}>
              {isBg
                ? 'MEafterMe никога не претендира за права върху вашите спомени, истории или лична информация. Ние сме само технологията, която ги пази.'
                : 'MEafterMe never claims rights over your memories, stories, or personal information. We are only the technology that keeps them safe.'}
            </p>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {sections.map((s, i) => (
            <div key={i} className="p-6 rounded-2xl" style={{ ...cardStyle, border: s.highlight ? '1px solid hsl(36 80% 55% / 0.3)' : '1px solid hsl(30 10% 18%)' }}>
              <h2 className="font-display font-bold mb-2" style={{ color: s.highlight ? amber : cream }}>
                {s.title}
              </h2>
              <p className="font-body text-sm leading-relaxed" style={{ color: dimmed }}>{s.body}</p>
            </div>
          ))}
        </div>

        {/* Footer links */}
        <div className="mt-10 flex flex-wrap gap-4 font-body text-sm">
          <Link href="/privacy" style={{ color: amber }} className="hover:underline">
            {isBg ? '→ Политика за поверителност' : '→ Privacy Policy'}
          </Link>
          <Link href="/pricing" style={{ color: amber }} className="hover:underline">
            {isBg ? '→ Планове и цени' : '→ Pricing'}
          </Link>
          <a href="mailto:contact@afterme.life" style={{ color: amber }} className="hover:underline">
            → contact@afterme.life
          </a>
        </div>
      </div>
    </main>
  );
}
