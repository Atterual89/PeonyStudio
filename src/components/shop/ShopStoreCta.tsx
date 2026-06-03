"use client";

import { useLanguage } from "@/components/site/LanguageProvider";

type Props = {
  href: string;
};

export function ShopStoreCta({ href }: Props) {
  const { dictionary } = useLanguage();

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="mt-7 inline-flex w-full justify-center rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white shadow-[0_8px_24px_rgba(33,24,21,0.16)] transition hover:-translate-y-0.5 sm:w-auto"
    >
      {dictionary.shop.ticketTailorCta}
    </a>
  );
}
