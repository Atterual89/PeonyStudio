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
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 md:grid-cols-[1fr_1fr_1fr]">
          <div>
            <p className="font-serif text-lg font-medium tracking-[0.08em] text-[#211815]">{footer.brand}</p>
            <p className="mt-1 text-sm text-[#5f524c]">{(footer as { tagline?: string }).tagline ?? footer.copyright}</p>
          </div>
          {footer.columns.map((column) => (
            <div key={column.title}>
              <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8b5e4a]">{column.title}</h2>
              <div className="grid gap-2">
                {column.links.map((link) => (
                  <Link key={`${column.title}-${link.label}`} href={link.href} className="text-sm text-[#5f524c] transition hover:text-[#211815]">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 border-t border-[#211815]/10 pt-5">
          <p className="text-xs text-[#5f524c]/65">{(footer as { copyright: string }).copyright}</p>
        </div>
      </div>
    </footer>
  );
}
