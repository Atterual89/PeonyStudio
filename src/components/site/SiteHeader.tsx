const navItems = [
  { href: "#start", label: "Come iniziare" },
  { href: "#programs", label: "Programmi" },
  { href: "#practice", label: "Pratica" },
  { href: "#calendar", label: "Calendario" },
];

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between">
      <div className="text-lg font-semibold tracking-wide">Peony Studio</div>

      <nav className="hidden gap-6 text-sm md:flex">
        {navItems.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
