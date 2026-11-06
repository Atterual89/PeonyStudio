// Fase 4e, gruppo 5: testi dell'interfaccia uniformati e telefono.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { rpcErrorMessage, withIscrizione } from "../errors";
import { MEMBERSHIP_SHORT_LABELS, membershipLabel } from "../membership-rule";
import { BOOKING_FILTERS } from "../bookings";
import { ROLE_LABELS, UI_LABELS } from "../labels";
import { SNAPSHOT_LABELS } from "../settlement";

const ROOT = process.cwd();
const files = (dir: string): string[] =>
  readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(ROOT, path)).isDirectory()) return name === "__tests__" ? [] : files(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
const SOURCES = ["src/app/gestione", "src/components/gestionale", "src/lib/gestionale"].flatMap(files).map((path) => ({
  path,
  // Senza commenti (// … e /* … */, anche quelli JSX): resta il codice con i testi visibili.
  code: readFileSync(join(ROOT, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1"),
}));

describe("testi visibili", () => {
  it("mai 'Prenotazione': sempre 'Iscrizione' (interfaccia, messaggi, export)", () => {
    // errors.ts traduce proprio questa parola nei messaggi del database.
    const offenders = SOURCES.filter(({ path, code }) => !path.endsWith("errors.ts") && /prenotazion/i.test(code)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it("i messaggi del database con 'prenotazione' arrivano come 'iscrizione'", () => {
    expect(withIscrizione("Una prenotazione ha al massimo due persone.")).toBe("Un'iscrizione ha al massimo due persone.");
    expect(withIscrizione("La prenotazione resterebbe senza persone: usa lo stato Cancellato.")).toBe(
      "L'iscrizione resterebbe senza persone: usa lo stato Cancellato.",
    );
    expect(withIscrizione("Si separa il partner, non la persona principale della prenotazione.")).toBe(
      "Si separa il partner, non la persona principale dell'iscrizione.",
    );
    expect(rpcErrorMessage({ code: "GW400", details: "Si può separare solo una prenotazione di coppia." })).toBe(
      "Si può separare solo un'iscrizione di coppia.",
    );
  });

  it("stato socio con le stesse parole: In regola · Quota non registrata · Modulo non trovato · Non collegata", () => {
    expect(MEMBERSHIP_SHORT_LABELS).toEqual({
      in_regola: "In regola",
      quota_mancante: "Quota non registrata",
      modulo_mancante: "Modulo non trovato",
      non_collegata: "Non collegata",
    });
    expect(membershipLabel({ kind: "in_regola", expiresAt: null, match: "manual" })).toBe("In regola (manuale)");
    expect(BOOKING_FILTERS.map((f) => f.label)).toContain("Richiesta inviata");
    expect(BOOKING_FILTERS.map((f) => f.label)).not.toContain("In attesa");
  });

  it("Guadagno (4g) e Da trasferire; sempre Ale; parole comuni in un unico punto", () => {
    expect(SNAPSHOT_LABELS.utile).toBe("Guadagno");
    expect(SNAPSHOT_LABELS.residuo).toBe("Da trasferire");
    expect(ROLE_LABELS.organizzatrice).toBe("Ale");
    // 4g (#12): niente più "Storna movimento".
    expect(UI_LABELS).not.toHaveProperty("reverseMovement");
    expect(UI_LABELS).toMatchObject({
      close: "Chiudi",
      undo: "Annulla",
      revokeValidation: "Revoca validazione",
      markMembershipPaid: "Segna quota associativa pagata",
      saved: "Salvato.",
    });
  });

  it("'Annulla' solo per l'undo; niente 'Segna quota ok', 'Annulla movimento', 'Annulla validazione'", () => {
    const offenders = SOURCES.filter(
      ({ path, code }) =>
        /Segna quota ok|Annulla movimento|Annulla validazione|Tesseramento in regola|Salva scheda|Salva dati|Salva spesa|Salva note/.test(code) ||
        (!path.endsWith("Deletion.tsx") && !path.endsWith("labels.ts") && /^\s*Annulla\s*$|"Annulla"/m.test(code)),
    ).map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});

describe("#30 — telefono", () => {
  it("4f: Importo · Metodo · Data affiancati (un campo che non entra va a capo); il menu '…' ha 8 px intorno", () => {
    const form = readFileSync(join(ROOT, "src/components/gestionale/PaymentForm.tsx"), "utf8");
    expect(form).toMatch(/<div className="flex flex-wrap gap-x-1.5 gap-y-2">\s*<Field label=\{refund \? "Restituiti" : "Importo"\}/);
    expect(form).toContain("<DateField className={PAYMENT_FIELD_WIDTH.date}");
    const ui = readFileSync(join(ROOT, "src/components/gestionale/ui.tsx"), "utf8");
    expect(ui).toContain('<details className="relative mx-2 shrink-0">');
  });
});
