"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BrandLogo } from "@/components/site/BrandLogo";

const navItems = [
  { href: "/come-iniziare", label: "Come iniziare" },
  { href: "/percorsi", label: "Percorsi" },
  { href: "/pratica", label: "Pratica & Community" },
  { href: "/workshop", label: "Workshop" },
  { href: "/calendario", label: "Calendario" },
  { href: "/peony", label: "Peony" },
  { href: "/shop", label: "Shop" },
  { href: "/dashboard", label: "Area personale" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header
        className={`sticky top-0 z-50 px-3 transition-[padding] duration-300 sm:px-4 ${
          scrolled ? "py-2" : "py-3.5"
        }`}
      >
        <div
          className={`mx-auto flex max-w-6xl items-center justify-between rounded-full border border-[#211815]/10 bg-[#f4efe8]/[0.82] py-2 pl-4 pr-2 backdrop-blur-[14px] transition-shadow duration-300 sm:pl-5 ${
            scrolled
              ? "shadow-[0_4px_24px_rgba(33,24,21,0.08)]"
              : "shadow-[0_1px_0_rgba(33,24,21,0.04)]"
          }`}
        >
          <Link href="/" aria-label="Peony Studio home">
            <BrandLogo compact />
          </Link>

          <nav className="hidden items-center gap-4 text-[12px] font-medium text-[#5f524c] xl:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="transition-colors hover:text-[#8b5e4a]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-10 rounded-full border border-[#211815]/20 bg-white/60 px-4 text-sm font-medium text-[#211815] transition hover:bg-white/85 xl:hidden"
          >
            Menu
          </button>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-[200] flex flex-col bg-[#f4efe8]/[0.97] px-5 py-5 backdrop-blur-xl transition-opacity duration-300 xl:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="mb-12 flex items-center justify-between">
          <BrandLogo />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Chiudi menu"
            className="grid h-11 w-11 place-items-center rounded-full border border-[#211815]/20 bg-white/70 text-lg text-[#211815]"
          >
            x
          </button>
        </div>

        <nav className="flex flex-col">
          {navItems.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center justify-between border-b border-[#211815]/10 py-4 font-serif text-3xl font-medium text-[#211815] transition duration-500 ${
                open ? "translate-x-0 opacity-100" : "-translate-x-3 opacity-0"
              }`}
              style={{ transitionDelay: `${open ? 100 + index * 50 : 0}ms` }}
            >
              <span>{item.label}</span>
              <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
                {String(index + 1).padStart(2, "0")}
              </span>
            </Link>
          ))}
        </nav>

        <p className="mt-auto border-t border-[#211815]/10 pt-5 text-sm text-[#5f524c]">
          Peony Studio — Kinbaku a Torino
        </p>
      </div>
    </>
  );
}
