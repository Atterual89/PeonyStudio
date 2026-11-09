// Verifiche "a codice" sul sorgente del gestionale (D11, D14, D17).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const GESTIONALE_DIRS = ["src/app/gestione", "src/components/gestionale", "src/lib/gestionale"];

function files(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(ROOT, path)).isDirectory()) return name === "__tests__" ? [] : files(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const SOURCES = GESTIONALE_DIRS.flatMap(files).map((path) => ({
  path: relative(ROOT, join(ROOT, path)).replaceAll("\\", "/"),
  code: readFileSync(join(ROOT, path), "utf8"),
}));

const MIGRATIONS = ["010_gw_schema_v1", "011_gw_functions_v2", "012_gw_correzioni_v2b", "013_gw_ruoli_pagamenti_v3", "014_gw_correzioni_admin_v3b", "015_gw_quota_workshop_v3c", "016_gw_soci_fonti_admin", "017_gw_riga_persona", "018_gw_consuntivo_v4", "019_gw_pagamenti_stato", "020_gw_eliminazioni", "021_gw_recap_economico", "022_gw_quota_ok", "023_gw_richieste_associazione", "024_gw_correzioni_revisione", "025_gw_anteprima_moduli", "026_gw_data_pagamento_facoltativa", "027_gw_functions_v5"].flatMap((name) =>
  ["", ".down"].map((suffix) => ({
    path: `supabase/migrations/${name}${suffix}.sql`,
    code: readFileSync(join(ROOT, "supabase/migrations", `${name}${suffix}.sql`), "utf8"),
  })),
);

describe("D17 — etichetta 'Ale'", () => {
  it("nessuna etichetta 'RedSabbath' nel codice del gestionale", () => {
    const offenders = SOURCES.filter(({ code }) => /red\s*sabbath/i.test(code.replace(/redsabbath/g, "")));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it("la parte 'redsabbath' si chiama 'Ale' in un unico punto", () => {
    const labels = SOURCES.find((f) => f.path.endsWith("lib/gestionale/labels.ts"));
    expect(labels?.code).toContain('redsabbath: "Ale"');
    const elsewhere = SOURCES.filter((f) => !f.path.endsWith("labels.ts") && /["'`]Ale["'`:]/.test(f.code));
    expect(elsewhere.map((f) => f.path)).toEqual([]);
  });
});

describe("D14 — events e ticket_tailor_* in sola lettura", () => {
  it("nessuna scrittura su events o ticket_tailor_* dal codice del gestionale", () => {
    const writes = /\.from\(\s*["'](events|ticket_tailor_\w+)["']\s*\)[\s\S]{0,200}?\.(insert|update|upsert|delete)\s*\(/;
    const offenders = SOURCES.filter(({ code }) => {
      // Solo la catena che parte da .from("events"/"ticket_tailor_*") fino al punto e virgola.
      const chains = code.match(/\.from\(\s*["'](?:events|ticket_tailor_\w+)["']\s*\)[^;]*;/g) ?? [];
      return chains.some((chain) => writes.test(chain));
    });
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it("events e biglietti TT sono letti solo dai loader e dalle validazioni Peony protette", () => {
    const eventReaders = SOURCES.filter(({ code }) => /\.from\(\s*["']events["']\s*\)/.test(code))
      .map((f) => f.path).sort();
    expect(eventReaders).toEqual([
      "src/lib/gestionale/server/events.ts",
      "src/lib/gestionale/server/peony-events.ts",
      "src/lib/gestionale/server/peony-person-history.ts",
    ]);
    const ticketReaders = SOURCES.filter(({ code }) => /\.from\(\s*["']ticket_tailor_/.test(code))
      .map((f) => f.path).sort();
    expect(ticketReaders).toEqual([
      "src/app/gestione/(app)/peony/actions.ts",
      "src/lib/gestionale/server/peony-events.ts",
      "src/lib/gestionale/server/peony-person-history.ts",
    ]);
  });

  it("le migrazioni del gestionale non toccano events né ticket_tailor_*", () => {
    const offenders = MIGRATIONS.filter(({ code }) => /\bpublic\.events\b|\bticket_tailor_/i.test(code.replace(/--.*$/gm, "")));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });
});

describe("D11 — libro soci", () => {
  it("nessuna scrittura su association_members e nessuna colonna sensibile letta", () => {
    for (const { path, code } of SOURCES) {
      const chains = code.match(/\.from\(\s*["']association_members["']\s*\)[^;]*;/g) ?? [];
      for (const chain of chains) {
        expect(chain, path).not.toMatch(/\.(insert|update|upsert|delete)\s*\(/);
      }
      expect(code, path).not.toMatch(/fiscal_code|birth_date|membership_card_number/);
    }
  });
});

describe("D22 — le righe eliminate non si leggono mai", () => {
  const TABLES = "workshops|people|bookings|booking_participants|payments|expenses|transfers|carryovers";

  it("ogni lettura di una tabella con deleted_at la filtra", () => {
    const offenders = SOURCES.flatMap(({ path, code }) =>
      (code.match(new RegExp(`\.from\(\s*["']gw_(?:${TABLES})["']\s*\)[^;]*;`, "g")) ?? [])
        .filter((chain) => !/\.is\(\s*["']deleted_at["']\s*,\s*null\s*\)/.test(chain))
        .map((chain) => `${path}: ${chain.slice(0, 80)}`),
    );
    expect(offenders).toEqual([]);
  });

  it("pagamenti e partecipanti letti dentro una prenotazione: filtrati anche loro", () => {
    const offenders = SOURCES.flatMap(({ path, code }) =>
      (code.match(/\.from\(\s*["']gw_bookings["']\s*\)[^;]*;/g) ?? []).flatMap((chain) =>
        ["gw_payments", "gw_booking_participants"]
          .filter((embedded) => chain.includes(`${embedded}(`) && !chain.includes(`"${embedded}.deleted_at"`))
          .map((embedded) => `${path}: ${embedded}`),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("niente finestre del browser per confermare un'eliminazione (conferma sul posto)", () => {
    const offenders = SOURCES.filter(({ code }) => /delete\w*Action/.test(code) && /window\.(confirm|alert|prompt)\s*\(/.test(code)).map(
      (f) => f.path,
    );
    expect(offenders).toEqual([]);
  });
});

describe("4d — aggiornamento immediato dopo ogni azione", () => {
  it("le server action usano refreshGestione (revalidate + refresh), mai refresh da solo", () => {
    const actions = SOURCES.filter(({ path, code }) => path.startsWith("src/app/gestione") && /^["']use server["']/.test(code));
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.filter(({ code }) => /from\s+["']next\/cache["']/.test(code)).map((f) => f.path)).toEqual([]);
    // Ogni azione che scrive (chiama una funzione di mutations) aggiorna la pagina.
    const missing = actions.flatMap(({ path, code }) =>
      code
        .split(/(?=^export async function )/m)
        .filter((block) => block.startsWith("export async function"))
        .filter((block) => /await (?!requireAdmin|requireOperator|requireOrganizer)\w+\(operator\.id/.test(block))
        .filter((block) => !/refreshGestione\(\)|return done\(|redirect\(/.test(block))
        .map((block) => `${path}: ${block.slice(22, 60)}`),
    );
    expect(missing).toEqual([]);
  });
});

describe("moduli compatti: menu a tendina", () => {
  it("niente gruppi di pulsanti a scelta nei moduli: i chip restano solo per i filtri degli elenchi", () => {
    const offenders = SOURCES.filter(
      ({ path, code }) =>
        path.startsWith("src/components/gestionale") &&
        !path.endsWith("/ui.tsx") &&
        // Scelta di un socio da un elenco di risultati, non un'opzione di modulo.
        !path.endsWith("/MemberLinker.tsx") &&
        /aria-pressed|ChoiceChips/.test(code),
    ).map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});

describe("020 — relazioni verso gw_operators indicate esplicitamente", () => {
  it("ogni select che annida gw_operators indica la foreign key (created_by e deleted_by sono ambigue)", () => {
    const offenders = SOURCES.flatMap(({ path, code }) =>
      (code.match(/gw_operators(?:!\w+)*\s*\(/g) ?? [])
        .filter((embed) => !/^gw_operators!gw_\w+_fkey(?:!inner)?\s*\($/.test(embed))
        .map((embed) => `${path}: ${embed}`),
    );
    expect(offenders).toEqual([]);
  });
});

describe("niente richieste continue al server", () => {
  it("ogni <Link> del gestionale ha prefetch={false}: pagine dinamiche e protette, il prefetch non si mette in cache", () => {
    const offenders = SOURCES.flatMap(({ path, code }) =>
      // Senza commenti: "<Link>" citato in un commento non è un link.
      (code.replace(/\/\*[\s\S]*?\*\//g, "").match(/<Link(?=[\s>])[^>]*>/g) ?? []).filter((tag) => !/\bprefetch=\{false\}/.test(tag)).map((tag) => `${path}: ${tag.slice(0, 60)}`),
    );
    expect(offenders).toEqual([]);
  });

  it("niente refresh(), router.refresh() né prefetch dentro un useEffect: si aggiorna solo dopo un'azione", () => {
    const offenders = SOURCES.flatMap(({ path, code }) =>
      code
        .split(/(?=useEffect\()/)
        .slice(1)
        .map((block) => block.slice(0, block.search(/\n {2}\}, \[|\n {2}\}\);/) + 1 || 600))
        .filter((effect) => /\b(router\.)?(refresh|prefetch)\(\)|router\.prefetch\(|revalidatePath\(/.test(effect))
        .map((effect) => `${path}: ${effect.slice(0, 60)}`),
    );
    expect(offenders).toEqual([]);
  });
});
