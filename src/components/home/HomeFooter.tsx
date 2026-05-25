import Link from "next/link";

import type { homeContent } from "@/content/home";

type HomeFooterProps = {
  content: typeof homeContent.footer;
};

export function HomeFooter({ content }: HomeFooterProps) {
  return (
    <footer className="border-t border-[#211815]/10 px-5 py-10 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.2fr_2fr]">
        <div>
          <p className="text-lg font-semibold tracking-wide">{content.brand}</p>
          <p className="mt-4 text-sm text-[#5f524c]">{content.copyright}</p>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          {content.columns.map((column) => (
            <div key={column.title}>
              <h2 className="mb-4 text-sm uppercase tracking-[0.2em] text-[#8b5e4a]">
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
