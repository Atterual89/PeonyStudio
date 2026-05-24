import Link from "next/link";

const navItems = [
  { href: "/come-iniziare", label: "Come iniziare" },
  { href: "/programmi", label: "Programmi" },
  { href: "/pratica", label: "Pratica" },
  { href: "/workshop-exploration", label: "Workshop & Exploration" },
  { href: "/calendario", label: "Calendario" },
  { href: "/peony", label: "Peony" },
  { href: "/shop", label: "Shop" },
];

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between">
      <Link href="/" className="text-lg font-semibold tracking-wide">
        Peony Studio
      </Link>

      <nav className="hidden gap-5 text-sm md:flex">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
