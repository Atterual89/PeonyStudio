"use client";

import { SectionTabSwitcher } from "@/components/layout/SectionTabSwitcher";
import { useLanguage } from "@/components/site/LanguageProvider";

export function TabsWrapper() {
  const { dictionary } = useLanguage();
  const nav = dictionary.nav;

  return (
    <SectionTabSwitcher
      tabs={[
        { href: "/percorsi/inizia",          label: nav.tabInizia },
        { href: "/percorsi",                 label: nav.tabPercorsi },
        { href: "/workshop",                 label: nav.workshops },
        { href: "/percorsi/socialita",       label: nav.tabSocialita },
        { href: "/percorsi/lezioni-private", label: nav.tabLezioniPrivate },
      ]}
    />
  );
}
