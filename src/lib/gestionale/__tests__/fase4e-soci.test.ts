// Fase 4e, gruppo 3 (Laura): corrispondenze esatte, stato per periodo, niente
// finestre del browser. Dati inventati.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isExactMemberMatch, uniqueExactMatches } from "../exact-matches";
import { periodLabel, personPeriods } from "../membership-rule";
import type { MemberSummary } from "../types";

const member = (id: string, first: string | null, last: string | null, email: string | null): MemberSummary => ({
  id,
  first_name: first,
  last_name: last,
  email,
  expires_at: null,
  source: "libro",
  name_split: true,
});
const person = (id: string, first: string | null, last: string | null, email: string | null) => ({
  id,
  version: 1,
  first_name: first,
  last_name: last,
  email,
});

describe("#10 — Collega le corrispondenze esatte", () => {
  it("esatta: stessa email, oppure stesso nome e cognome senza email diverse", () => {
    expect(isExactMemberMatch(person("p", null, null, "Nora@Example.com"), member("e:nora@example.com", "Nora", "Pini", "nora@example.com"))).toBe(true);
    expect(isExactMemberMatch(person("p", "Nóra", "Pini", null), member("n:pini nora", "Nora", "Pini", null))).toBe(true);
    expect(isExactMemberMatch(person("p", "Nora", "Pini", "altra@example.com"), member("e:nora@example.com", "Nora", "Pini", "nora@example.com"))).toBe(false);
    expect(isExactMemberMatch(person("p", "Nora", null, null), member("n:nora", "Nora", null, null))).toBe(false);
    expect(isExactMemberMatch(person("p", "Nora", "Pini", null), member("n:pini nora bis", "Nora", "Pini Bis", null))).toBe(false);
  });

  it("solo uniche: una persona con due soci esatti o un socio per due persone non si propongono", () => {
    const matches = uniqueExactMatches([
      { person: person("a", "Nora", "Pini", null), personName: "Nora Pini", members: [member("n:pini nora", "Nora", "Pini", null)] },
      { person: person("b", "Vela", "Rossi", null), personName: "Vela Rossi", members: [member("e:v1@x.it", "Vela", "Rossi", "v1@x.it"), member("e:v2@x.it", "Vela", "Rossi", "v2@x.it")] },
      { person: person("c", "Gaia", "Neri", null), personName: "Gaia Neri", members: [member("n:neri gaia", "Gaia", "Neri", null)] },
      { person: person("d", null, null, "gaia@x.it"), personName: "gaia", members: [member("n:neri gaia", "Gaia", "Neri", "gaia@x.it")] },
    ]);
    expect(matches).toEqual([{ personId: "a", version: 1, personName: "Nora Pini", memberId: "n:pini nora", memberName: "Nora Pini", memberEmail: null }]);
  });
});

describe("#15 — stato tessera per periodo nella scheda persona", () => {
  it("periodi di oggi e dei workshop della persona, con nome breve", () => {
    const periods = personPeriods("2026-10-29", ["2027-02-06", "2026-11-14", "2025-06-01"]);
    expect(periods.map(periodLabel)).toEqual(["2025/26", "2027"]);
    expect(periods.map((p) => p.paymentsFrom)).toEqual(["2025-09-01", "2027-01-01"]);
  });
});

describe("#16 — nessuna finestra del browser nel gestionale", () => {
  const ROOT = process.cwd();
  const files = (dir: string): string[] =>
    readdirSync(join(ROOT, dir)).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(join(ROOT, path)).isDirectory()) return name === "__tests__" ? [] : files(path);
      return /\.(ts|tsx)$/.test(name) ? [path] : [];
    });

  it("nessuna window.confirm / alert / prompt", () => {
    const offenders = ["src/app/gestione", "src/components/gestionale", "src/lib/gestionale"]
      .flatMap(files)
      .filter((path) => /window\.(confirm|alert|prompt)\s*\(|(^|[^.\w])(confirm|alert|prompt)\s*\(\s*[`"']/m.test(readFileSync(join(ROOT, path), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("'Altri nomi' sta subito sotto il campo Nickname", () => {
    const form = readFileSync(join(ROOT, "src/components/gestionale/PersonForm.tsx"), "utf8");
    expect(form.indexOf('input("nickname")')).toBeGreaterThan(0);
    expect(form.indexOf("<PersonAliases")).toBeGreaterThan(form.indexOf('input("nickname")'));
    expect(form.indexOf("<PersonAliases")).toBeLessThan(form.indexOf('field !== "nickname"'));
  });
});
