"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useLanguage } from "@/components/site/LanguageProvider";

export function GlobalFooter() {
  const pathname = usePathname();
  const { dictionary } = useLanguage();
  const footer = dictionary.footer;

  // Not shown in area personale
  if (pathname.startsWith("/area-personale")) return null;

  return (
    <footer className="border-t border-[#211815]/10 bg-[#efe4d7] px-5 py-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 md:grid-cols-[1fr_1fr_1fr]">
          {/* Col 1 — Brand */}
          <div>
            <p className="font-serif text-lg font-medium tracking-[0.08em] text-[#211815]">
              {footer.brand}
            </p>
            <p className="mt-1 text-sm text-[#5f524c]">{footer.tagline}</p>
            <div className="mt-4 flex gap-3">
              <a
                href="https://www.instagram.com/peony.studio.turin"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="grid h-8 w-8 place-items-center rounded-full border border-[#211815]/15 bg-white/45 text-[#5f524c] transition hover:bg-white/70"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
                </svg>
              </a>
              <a
                href="https://t.me/peony_studio_turin"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
                className="grid h-8 w-8 place-items-center rounded-full border border-[#211815]/15 bg-white/45 text-[#5f524c] transition hover:bg-white/70"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 3L2 10l7 3 2 7 4-5 5 4L22 3z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Cols 2-3 — Links */}
          {footer.columns.map((column) => (
            <div key={column.title}>
              <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8b5e4a]">
                {column.title}
              </h2>
              <div className="grid gap-2">
                {column.links.map((link) => (
                  <Link
                    key={`${column.title}-${link.label}`}
                    href={link.href}
                    className="text-sm text-[#5f524c] transition hover:text-[#211815]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-8 flex flex-col items-start justify-between gap-3 border-t border-[#211815]/10 pt-5 sm:flex-row sm:items-center">
          <Link
            href={footer.contactHref}
            className="text-sm font-medium text-[#8b5e4a] transition hover:text-[#211815]"
          >
            {footer.contact}
          </Link>
          <p className="text-xs text-[#5f524c]/65">{footer.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
