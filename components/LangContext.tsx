'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Locale } from '@/dictionaries';
import type { Dict } from '@/dictionaries/en';
import { en } from '@/dictionaries/en';
import { bg } from '@/dictionaries/bg';

interface LangContextValue {
  locale: Locale;
  dict: Dict;
  setLocale: (l: Locale) => void;
}

const LangContext = createContext<LangContextValue>({
  locale: 'en',
  dict: en,
  setLocale: () => {},
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const dict: Dict = locale === 'bg' ? (bg as unknown as Dict) : en;

  useEffect(() => {
    try {
      const saved = localStorage.getItem('meafterme_locale') as Locale | null;
      if (saved === 'bg' || saved === 'en') setLocaleState(saved);
    } catch {}
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem('meafterme_locale', l); } catch {}
  }, []);

  return (
    <LangContext.Provider value={{ locale, dict, setLocale }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
