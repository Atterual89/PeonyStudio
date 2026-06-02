import { en } from "@/i18n/dictionaries/en";
import { it } from "@/i18n/dictionaries/it";
import { defaultLocale, type Locale } from "@/i18n/config";

const dictionaries = {
  it,
  en,
};

export type Dictionary = typeof it;

export function getDictionary(locale: Locale = defaultLocale): Dictionary {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}
