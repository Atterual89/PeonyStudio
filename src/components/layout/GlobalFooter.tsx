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
    <footer className="border-t border-[#211815]/10 bg-[#efe4d7] px-5 py-6 pb-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-2 gap-6">
          {/* Col sinistra — Brand + social */}
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-[#211815] mb-1">{footer.brand}</p>
            <p className="text-xs text-[#9a8a7e] mb-4">{footer.tagline}</p>
            <div className="flex gap-3">
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

          {/* Col destra — Link gruppi */}
          <div className="space-y-4">
            {footer.columns.map((column) => (
              <div key={column.title}>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#b07a5a] mb-2">{column.title}</p>
                <div className="grid gap-1.5">
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
        </div>

        {/* Bottom — email + copyright */}
        <div className="mt-6 border-t border-[#211815]/10 pt-5">
          <a
            href="mailto:peony.studio.turin@gmail.com"
            className="text-sm text-[#c9a98a] underline underline-offset-2 mt-6 block"
          >
            peony.studio.turin@gmail.com
          </a>
          <p className="mt-2 text-xs text-[#5f524c]/65">{footer.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
