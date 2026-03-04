'use client';
import Link from 'next/link';
import { useLang } from '@/components/LangContext';

export default function HomePage() {
  const { dict, locale } = useLang();
  const isBg = locale === 'bg';

  return (
    <div style={{ backgroundColor: 'hsl(30 15% 7%)', color: 'hsl(38 50% 92%)' }}>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden py-20 px-4">
        {/* Background glow orbs */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
             style={{ background: 'radial-gradient(circle, hsl(36 80% 55% / 0.07), transparent 70%)' }} />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 mb-8">
            <span className="px-4 py-1.5 rounded-full text-xs font-medium tracking-widest uppercase"
                  style={{ backgroundColor: 'hsl(36 80% 55% / 0.15)', color: 'hsl(36 80% 55%)', border: '1px solid hsl(36 80% 55% / 0.3)' }}>
              {isBg ? 'Цифрово наследство' : 'Digital Legacy'}
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-display font-bold leading-[1.1] mb-6 tracking-tight"
              style={{ fontSize: 'clamp(2.8rem, 7vw, 5rem)' }}>
            <span style={{ background: 'linear-gradient(135deg, hsl(36 80% 55%) 0%, hsl(38 50% 92%) 60%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {isBg ? 'Запазете историите.' : 'Preserve the stories.'}
            </span>
            <br />
            <span style={{ color: 'hsl(38 50% 92%)' }}>
              {isBg ? 'Завинаги.' : 'Forever.'}
            </span>
          </h1>

          {/* Subheadline */}
          <p className="font-body text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
             style={{ color: 'hsl(38 50% 92% / 0.7)' }}>
            {isBg
              ? 'MEafterMe помага на хората да съхранят историята на живота си — с техния собствен глас и думи — така че бъдещите поколения да могат наистина да ги познават.'
              : 'MEafterMe helps people preserve their life stories — in their own voice and words — so future generations can truly know them.'}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/login"
              className="font-body font-semibold px-8 py-4 rounded-full text-base transition-all duration-200 hover:scale-105 hover:shadow-lg"
              style={{ backgroundColor: 'hsl(36 80% 55%)', color: 'hsl(30 15% 7%)' }}>
              {isBg ? 'Започни безплатно' : 'Start for free'}
            </Link>
            <Link href="/experience"
              className="font-body font-semibold px-8 py-4 rounded-full text-base transition-all duration-200 hover:scale-105"
              style={{ backgroundColor: 'hsl(30 12% 11%)', color: 'hsl(38 50% 92%)', border: '1px solid hsl(30 10% 18%)' }}>
              {isBg ? 'Научи повече' : 'Learn more'}
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce"
             style={{ color: 'hsl(38 50% 92% / 0.3)' }}>
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 px-4" style={{ backgroundColor: 'hsl(30 12% 11%)' }}>
        <div className="max-w-5xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-16">
            <p className="font-body font-semibold tracking-widest uppercase mb-4"
               style={{ fontSize: '0.75rem', color: 'hsl(36 80% 55%)', letterSpacing: '0.15em' }}>
              {isBg ? 'Как работи' : 'How it works'}
            </p>
            <h2 className="font-display font-bold"
                style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', color: 'hsl(38 50% 92%)', lineHeight: 1.15 }}>
              {isBg ? (
                <>
                  Три стъпки до{' '}
                  <em style={{ color: 'hsl(36 80% 55%)', fontStyle: 'italic' }}>безсмъртие</em>
                </>
              ) : (
                <>
                  Three steps to{' '}
                  <em style={{ color: 'hsl(36 80% 55%)', fontStyle: 'italic' }}>immortality</em>
                </>
              )}
            </h2>
          </div>

          {/* 3 cards */}
          <div className="grid sm:grid-cols-3 gap-6">
            {(isBg
              ? [
                  {
                    icon: (
                      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    ),
                    title: 'Качете спомени',
                    desc: 'Снимки, видеоклипове, аудио записи и документи — всичко, което разказва вашата история.',
                  },
                  {
                    icon: (
                      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l7 7-7 7M13 5l6 6-6 6" />
                        <circle cx="12" cy="12" r="1" fill="currentColor"/>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    ),
                    title: 'AI създава аватар',
                    desc: 'Изкуственият интелект анализира спомените ви и създава персонален цифров двойник с вашия глас и характер.',
                  },
                  {
                    icon: (
                      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    ),
                    title: 'Разговаряйте',
                    desc: 'Бъдещите поколения могат да задават въпроси и да получават отговори — сякаш говорят с вас.',
                  },
                ]
              : [
                  {
                    icon: (
                      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    ),
                    title: 'Upload memories',
                    desc: 'Photos, videos, audio recordings and documents — everything that tells your story.',
                  },
                  {
                    icon: (
                      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    ),
                    title: 'AI creates an avatar',
                    desc: 'Artificial intelligence analyzes your memories and creates a personal digital twin with your voice and character.',
                  },
                  {
                    icon: (
                      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    ),
                    title: 'Have a conversation',
                    desc: "Future generations can ask questions and receive answers — as if they're talking to you.",
                  },
                ]
            ).map((step, i) => (
              <div key={i}
                   className="p-8 rounded-2xl"
                   style={{ backgroundColor: 'hsl(30 10% 14%)', border: '1px solid hsl(30 10% 20%)' }}>
                {/* Icon in amber rounded-square */}
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-6"
                     style={{ backgroundColor: 'hsl(36 80% 55% / 0.18)', color: 'hsl(36 80% 55%)' }}>
                  {step.icon}
                </div>
                <h3 className="font-display font-bold mb-3"
                    style={{ fontSize: '1.2rem', color: 'hsl(38 50% 92%)' }}>
                  {step.title}
                </h3>
                <p className="font-body text-sm leading-relaxed"
                   style={{ color: 'hsl(38 50% 92% / 0.6)' }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES / CAPABILITIES ── */}
      <section className="py-24 px-4" style={{ backgroundColor: 'hsl(30 15% 7%)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="font-body font-semibold tracking-widest uppercase mb-4"
               style={{ fontSize: '0.75rem', color: 'hsl(36 80% 55%)', letterSpacing: '0.15em' }}>
              {isBg ? 'Възможности' : 'Features'}
            </p>
            <h2 className="font-display font-bold"
                style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', lineHeight: 1.15 }}>
              <span style={{ color: 'hsl(38 50% 92%)' }}>
                {isBg ? 'Вашата ' : 'Your '}
              </span>
              <em style={{ color: 'hsl(36 80% 55%)', fontStyle: 'italic', fontFamily: "'Playfair Display', Georgia, serif" }}>
                {isBg ? 'галерия' : 'gallery'}
              </em>
              <span style={{ color: 'hsl(38 50% 92%)' }}>
                {isBg ? ' с спомени' : ' of memories'}
              </span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {(isBg
              ? [
                  {
                    icon: (
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    ),
                    title: 'Снимки',
                    desc: 'Качвайте и организирайте снимки от целия живот',
                  },
                  {
                    icon: (
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                      </svg>
                    ),
                    title: 'Видеоклипове',
                    desc: 'Видео спомени с вашия автентичен глас',
                    highlight: true,
                  },
                  {
                    icon: (
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    ),
                    title: 'Аудио записи',
                    desc: 'Гласови послания и разкази за бъдещите поколения',
                  },
                  {
                    icon: (
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    ),
                    title: 'Документи',
                    desc: 'Писма, рецепти, дневници — всичко важно',
                  },
                  {
                    icon: (
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    ),
                    title: 'Частен профил',
                    desc: 'Само вашето семейство има достъп',
                    highlight: true,
                  },
                  {
                    icon: (
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    ),
                    title: 'За семейства',
                    desc: 'Споделете наследството с близките си',
                  },
                ]
              : [
                  {
                    icon: (
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    ),
                    title: 'Photos',
                    desc: 'Upload and organize photos from your entire life',
                  },
                  {
                    icon: (
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                      </svg>
                    ),
                    title: 'Videos',
                    desc: 'Video memories with your authentic voice',
                    highlight: true,
                  },
                  {
                    icon: (
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    ),
                    title: 'Audio recordings',
                    desc: 'Voice messages and stories for future generations',
                  },
                  {
                    icon: (
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    ),
                    title: 'Documents',
                    desc: 'Letters, recipes, journals — everything important',
                  },
                  {
                    icon: (
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    ),
                    title: 'Private profile',
                    desc: 'Only your family has access',
                    highlight: true,
                  },
                  {
                    icon: (
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    ),
                    title: 'For families',
                    desc: 'Share your legacy with your loved ones',
                  },
                ]
            ).map((item, i) => (
              <div key={i}
                   className="p-6 rounded-2xl"
                   style={item.highlight
                     ? { backgroundColor: 'hsl(30 10% 14%)', border: '1px solid hsl(30 12% 22%)' }
                     : { backgroundColor: 'transparent', border: '1px solid transparent' }
                   }>
                <div className="flex items-center gap-3 mb-3"
                     style={{ color: 'hsl(36 80% 55%)' }}>
                  {item.icon}
                  <h3 className="font-display font-bold"
                      style={{ fontSize: '1.05rem', color: 'hsl(38 50% 92%)' }}>
                    {item.title}
                  </h3>
                </div>
                <p className="font-body text-sm leading-relaxed"
                   style={{ color: 'hsl(38 50% 92% / 0.6)' }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI AVATAR ── */}
      <section className="py-24 px-4" style={{ backgroundColor: 'hsl(30 12% 11%)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="font-body font-semibold tracking-widest uppercase mb-4"
               style={{ fontSize: '0.75rem', color: 'hsl(36 80% 55%)', letterSpacing: '0.15em' }}>
              {isBg ? 'AI Аватар' : 'AI Avatar'}
            </p>
            <h2 className="font-display font-bold mb-4"
                style={{ fontSize: 'clamp(1.8rem, 4vw, 2.75rem)', color: 'hsl(38 50% 92%)' }}>
              {isBg ? 'Разговор отвъд времето' : 'Conversation beyond time'}
            </h2>
            <p className="font-body text-lg max-w-xl mx-auto leading-relaxed"
               style={{ color: 'hsl(38 50% 92% / 0.65)' }}>
              {isBg
                ? 'Персоналният AI аватар отговаря въз основа на качените спомени — с гласа и характера на вашия близък.'
                : 'The personal AI avatar responds based on uploaded memories — with the voice and character of your loved one.'}
            </p>
          </div>

          {/* Chat UI mockup */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid hsl(30 10% 20%)', backgroundColor: 'hsl(30 10% 14%)' }}>
            {/* Chat header */}
            <div className="px-6 py-4 flex items-center gap-3"
                 style={{ backgroundColor: 'hsl(30 10% 12%)', borderBottom: '1px solid hsl(30 10% 20%)' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                   style={{ backgroundColor: 'hsl(36 80% 55% / 0.2)', border: '1px solid hsl(36 80% 55% / 0.3)' }}>
                👵
              </div>
              <div>
                <div className="font-display font-semibold text-sm" style={{ color: 'hsl(38 50% 92%)' }}>
                  {isBg ? 'Баба Мария' : 'Grandma Maria'}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(142 70% 50%)' }} />
                  <span className="font-body text-xs" style={{ color: 'hsl(38 50% 92% / 0.5)' }}>
                    {isBg ? 'AI Аватар • Онлайн' : 'AI Avatar • Online'}
                  </span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="p-6 space-y-5">
              <div className="flex justify-end">
                <div className="max-w-[78%] px-4 py-3 rounded-2xl rounded-br-sm font-body text-sm"
                     style={{ backgroundColor: 'hsl(36 80% 55%)', color: 'hsl(30 15% 7%)' }}>
                  {isBg ? 'Баба, разкажи ми за детството си.' : 'Grandma, tell me about your childhood.'}
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm"
                     style={{ backgroundColor: 'hsl(36 80% 55% / 0.2)', border: '1px solid hsl(36 80% 55% / 0.3)' }}>
                  👵
                </div>
                <div className="max-w-[78%] px-4 py-3 rounded-2xl rounded-bl-sm font-body text-sm leading-relaxed"
                     style={{ backgroundColor: 'hsl(30 12% 11%)', color: 'hsl(38 50% 92% / 0.9)', border: '1px solid hsl(30 10% 20%)' }}>
                  {isBg
                    ? 'О, ние живеехме в малко село близо до Пловдив. Помня как всяка сутрин ходех с баща ми на нивата. Въздухът миришеше на прясна пръст и рози. Бяхме бедни, но щастливи...'
                    : "Oh, we lived in a small village near Plovdiv. I remember going to the fields with my father every morning. The air smelled of fresh earth and roses. We were poor but happy..."}
                </div>
              </div>

              <div className="flex justify-end">
                <div className="max-w-[78%] px-4 py-3 rounded-2xl rounded-br-sm font-body text-sm"
                     style={{ backgroundColor: 'hsl(36 80% 55%)', color: 'hsl(30 15% 7%)' }}>
                  {isBg ? 'Какво те правеше щастлива?' : 'What made you happy?'}
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm"
                     style={{ backgroundColor: 'hsl(36 80% 55% / 0.2)', border: '1px solid hsl(36 80% 55% / 0.3)' }}>
                  👵
                </div>
                <div className="max-w-[78%] px-4 py-3 rounded-2xl rounded-bl-sm font-body text-sm leading-relaxed"
                     style={{ backgroundColor: 'hsl(30 12% 11%)', color: 'hsl(38 50% 92% / 0.9)', border: '1px solid hsl(30 10% 20%)' }}>
                  {isBg
                    ? 'Щастието за мен винаги беше в малките неща — звука на дъжда по покрива, смеха на децата, миризмата на прясно изпечен хляб. И разбира се — семейството. Вие, внуците ми, сте най-голямата ми радост.'
                    : 'Happiness for me was always in the little things — the sound of rain on the roof, the laughter of children, the smell of freshly baked bread. And of course — family. You, my grandchildren, are my greatest joy.'}
                </div>
              </div>

              {/* Input area */}
              <div className="flex gap-3 items-center pt-2" style={{ borderTop: '1px solid hsl(30 10% 20%)' }}>
                <div className="flex-1 px-4 py-3 rounded-full font-body text-sm"
                     style={{ backgroundColor: 'hsl(30 12% 11%)', color: 'hsl(38 50% 92% / 0.35)', border: '1px solid hsl(30 10% 20%)' }}>
                  {isBg ? 'Задайте въпрос...' : 'Ask a question...'}
                </div>
                <button className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                        style={{ backgroundColor: 'hsl(36 80% 55%)', color: 'hsl(30 15% 7%)' }}>
                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 3L13.43 10.57M21 3l-6.5 19a.5.5 0 01-.94.02L10 13 1 9.44a.5.5 0 01.02-.94L21 3z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA SECTION ── */}
      <section className="py-28 px-4 relative overflow-hidden" style={{ backgroundColor: 'hsl(30 15% 7%)' }}>
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse at center, hsl(36 80% 55% / 0.05), transparent 65%)' }} />
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <h2 className="font-display font-bold mb-6 leading-tight"
              style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', color: 'hsl(38 50% 92%)' }}>
            {isBg ? (
              <>
                Не чакайте да стане{' '}
                <br />
                <em style={{ color: 'hsl(36 80% 55%)', fontStyle: 'italic' }}>твърде късно</em>
              </>
            ) : (
              <>
                {"Don't wait until it's"}
                <br />
                <em style={{ color: 'hsl(36 80% 55%)', fontStyle: 'italic' }}>too late</em>
              </>
            )}
          </h2>
          <p className="font-body text-base mb-10 leading-relaxed max-w-md mx-auto"
             style={{ color: 'hsl(38 50% 92% / 0.6)' }}>
            {isBg
              ? 'Всеки ден е възможност да запазите историите на хората, които обичате. Започнете днес.'
              : 'Every day is an opportunity to preserve the stories of the people you love. Start today.'}
          </p>
          <Link href="/login"
            className="font-body font-semibold px-10 py-4 rounded-full text-base transition-all duration-200 hover:scale-105 hover:shadow-lg inline-flex items-center gap-2"
            style={{ backgroundColor: 'hsl(36 80% 55%)', color: 'hsl(30 15% 7%)' }}>
            {isBg ? 'Създайте профил' : 'Create a profile'}
            <span>→</span>
          </Link>
        </div>
      </section>

    </div>
  );
}
