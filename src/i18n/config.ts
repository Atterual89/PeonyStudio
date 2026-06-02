export const locales = ["it", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "it";

export const localeCookieName = "peony-locale";

export const languageOptions: Array<{
  locale: Locale;
  code: string;
  flag: string;
  label: string;
}> = [
  { locale: "it", code: "IT", flag: "🇮🇹", label: "Italiano" },
  { locale: "en", code: "EN", flag: "🇬🇧", label: "English" },
];

export function isLocale(value: string | null | undefined): value is Locale {
  return locales.includes(value as Locale);
}
