// dictionaries/index.ts
import { en } from './en';
import { bg } from './bg';
import type { Dict } from './en';

export type Locale = 'en' | 'bg';

const dicts: Record<Locale, Dict> = { en, bg: bg as unknown as Dict };

export function getDictionary(locale: Locale | string): Dict {
  return dicts[(locale as Locale) in dicts ? (locale as Locale) : 'en'];
}

export { en, bg };
export type { Dict };
