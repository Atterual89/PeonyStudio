"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  defaultLocale,
  isLocale,
  localeCookieName,
  type Locale,
} from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/getDictionary";

type LanguageContextValue = {
  locale: Locale;
  dictionary: Dictionary;
  setLocale: (locale: Locale) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") {
      return defaultLocale;
    }

    const stored =
      window.localStorage.getItem(localeCookieName) ??
      document.cookie
        .split("; ")
        .find((row) => row.startsWith(`${localeCookieName}=`))
        ?.split("=")[1];

    return isLocale(stored) ? stored : defaultLocale;
  });

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LanguageContextValue>(() => {
    function setLocale(nextLocale: Locale) {
      setLocaleState(nextLocale);
      window.localStorage.setItem(localeCookieName, nextLocale);
      document.cookie = `${localeCookieName}=${nextLocale};path=/;max-age=31536000;samesite=lax`;
      document.documentElement.lang = nextLocale;
    }

    return {
      locale,
      dictionary: getDictionary(locale),
      setLocale,
    };
  }, [locale]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }

  return context;
}
