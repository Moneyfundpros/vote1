/**
 * i18n configuration (M14). Locales: English (default), Hausa, Yoruba, Igbo, Nigerian Pidgin.
 * Civic/legal copy (consent, methodology, receipts) must be fully translated — comprehension is a
 * trust requirement. Full next-intl request routing is wired on top of these catalogs.
 */
export const locales = ['en', 'ha', 'yo', 'ig', 'pcm'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  ha: 'Hausa',
  yo: 'Yorùbá',
  ig: 'Igbo',
  pcm: 'Nigerian Pidgin',
};

export async function loadMessages(locale: Locale): Promise<Record<string, unknown>> {
  const mod = (await import(`./messages/${locale}.json`)) as { default: Record<string, unknown> };
  return mod.default;
}
