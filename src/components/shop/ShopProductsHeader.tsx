"use client";

import { useLanguage } from "@/components/site/LanguageProvider";
import { shopBilingual } from "@/content/shop";

export function ShopProductsHeader() {
  const { locale } = useLanguage();
  const s = shopBilingual[locale]?.products ?? shopBilingual.it.products;

  return (
    <div className="mb-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
        {s.eyebrow}
      </p>
      <h2 className="mt-2 font-serif text-4xl font-medium leading-[1.04] md:text-5xl">
        {s.title}
      </h2>
    </div>
  );
}
