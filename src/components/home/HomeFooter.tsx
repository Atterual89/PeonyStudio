"use client";

import Link from "next/link";

import { useLanguage } from "@/components/site/LanguageProvider";
import type { homeContent } from "@/content/home";

type HomeFooterProps = {
  content: typeof homeContent.footer;
};

export function HomeFooter({ content }: HomeFooterProps) {
  const { dictionary } = useLanguage();
  const footer = dictionary.footer ?? content;

  return (
    <footer className="border-t border-[#211815]/10 bg-[#efe4d7] px-5 py-10 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.2fr_2fr]">
        <div>
          <p className="font-serif text-lg font-medium tracking-[0.08em]">
            {footer.brand}
          </p>
          <p className="mt-4 text-sm text-[#5f524c]">{footer.copyright}</p>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          {footer.columns.map((column) => (
            <div key={column.title}>
              <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8b5e4a]">
                {column.title}
              </h2>
              <div className="grid gap-2">
                {column.links.map((link) => (
                  <Link
                    key={`${column.title}-${link.label}`}
                    href={link.href}
                    className="text-sm text-[#5f524c]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
