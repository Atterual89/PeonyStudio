"use client";

import { useEffect, useRef, useState } from "react";

import { useLanguage } from "@/components/site/LanguageProvider";
import { languageOptions, type Locale } from "@/i18n/config";

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, dictionary } = useLanguage();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const activeOption =
    languageOptions.find((option) => option.locale === locale) ??
    languageOptions[0];

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function choose(nextLocale: Locale) {
    setLocale(nextLocale);
    setOpen(false);
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        aria-label={dictionary.chrome.chooseLanguage}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex items-center gap-2 rounded-full border border-[#211815]/15 bg-white/60 font-semibold text-[#211815] transition hover:bg-white/85 ${
          compact ? "px-3 py-2 text-xs" : "px-3.5 py-2 text-[12px]"
        }`}
      >
        <span aria-hidden="true">{activeOption.flag}</span>
        <span>{activeOption.code}</span>
        <span aria-hidden="true" className="text-[#8b5e4a]">
          ▾
        </span>
      </button>

      <div
        role="menu"
        className={`absolute right-0 top-[calc(100%+8px)] z-[260] min-w-36 rounded-[8px] border border-[#211815]/10 bg-[#f4efe8] p-1.5 shadow-[0_18px_38px_rgba(33,24,21,0.14)] transition ${
          open
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0"
        }`}
      >
        {languageOptions.map((option) => (
          <button
            key={option.locale}
            type="button"
            role="menuitem"
            onClick={() => choose(option.locale)}
            className={`flex w-full items-center gap-2 rounded-[6px] px-3 py-2 text-left text-sm transition ${
              option.locale === locale
                ? "bg-[#8b5e4a]/12 text-[#8b5e4a]"
                : "text-[#211815] hover:bg-white/65"
            }`}
          >
            <span aria-hidden="true">{option.flag}</span>
            <span className="font-semibold">{option.code}</span>
            <span className="text-xs text-[#5f524c]">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
