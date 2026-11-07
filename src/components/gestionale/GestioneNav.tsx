"use client";

import { CalendarDays, Ellipsis, Search, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { OperatorRole } from "@/lib/gestionale/types";

type Item = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean };

// D18: l'organizzatrice vede solo Workshop · Altro. Le pagine nascoste
// rispondono comunque 404 lato server.
const items: Item[] = [
  { href: "/gestione", label: "Eventi", icon: CalendarDays },
  { href: "/gestione/cerca", label: "Cerca", icon: Search, adminOnly: true },
  { href: "/gestione/persone", label: "Persone", icon: Users, adminOnly: true },
  { href: "/gestione/altro", label: "Altro", icon: Ellipsis },
];

function isActive(href: string, pathname: string) {
  if (href === "/gestione") {
    return pathname === "/gestione" || pathname.startsWith("/gestione/w/") || pathname.startsWith("/gestione/e/") || pathname.startsWith("/gestione/peony/");
  }
  if (href === "/gestione/persone") {
    return pathname.startsWith("/gestione/persone") || pathname.startsWith("/gestione/p/");
  }
  return pathname.startsWith(href);
}

export function GestioneNav({ role }: { role: OperatorRole }) {
  const pathname = usePathname();
  const visible = items.filter((item) => role === "admin" || !item.adminOnly);

  return (
    <nav
      aria-label="Navigazione gestionale"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[#211815]/10 bg-[#f2ede3]/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="mx-auto flex max-w-5xl">
        {visible.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname);
          return (
            <li key={href} className="flex-1">
              <Link prefetch={false}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors ${
                  active ? "text-[#a8583e]" : "text-[#5f524c]"
                }`}
              >
                <Icon className="h-6 w-6" aria-hidden="true" strokeWidth={1.8} />
                {role === "organizzatrice" && href === "/gestione" ? "Workshop" : label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
