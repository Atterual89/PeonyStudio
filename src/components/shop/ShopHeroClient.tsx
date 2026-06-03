"use client";

import { useLanguage } from "@/components/site/LanguageProvider";
import { ShopStoreCta } from "@/components/shop/ShopStoreCta";
import { shopBilingual } from "@/content/shop";

type Props = {
  storeUrl?: string;
};

export function ShopHeroClient({ storeUrl }: Props) {
  const { locale } = useLanguage();
  const s = shopBilingual[locale]?.hero ?? shopBilingual.it.hero;

  return (
    <div className="max-w-3xl">
      <p className="mb-5 text-sm uppercase tracking-[0.3em] text-[#8b5e4a]">
        {s.eyebrow}
      </p>
      <h1 className="mb-6 font-serif text-5xl font-medium leading-[1.02] md:text-7xl">
        {s.title}
      </h1>
      <p className="max-w-2xl text-lg leading-8 text-[#5f524c]">
        {s.intro}
      </p>
      {storeUrl ? <ShopStoreCta href={storeUrl} /> : null}
    </div>
  );
}
