"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { inputClass } from "./ui";

/** Campo di ricerca che aggiorna ?q= nell'URL (con debounce): la pagina filtra lato server. */
export function UrlSearchBox({ initialQuery, placeholder }: { initialQuery: string; placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    if (query === initialQuery) return;
    const timer = setTimeout(() => {
      const q = query.trim();
      router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, { scroll: false });
    }, 250);
    return () => clearTimeout(timer);
  }, [query, initialQuery, pathname, router]);

  return (
    <label className="relative block">
      <span className="sr-only">Cerca</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#5f524c]" aria-hidden="true" />
      <input
        type="search"
        className={`${inputClass} pl-10`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
      />
    </label>
  );
}
