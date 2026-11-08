import { normalizeMembershipEmail, normalizeMembershipNameKey } from "@/lib/association/membership-state";

/** Una persona può avere prove distinte per periodi e fonti diversi.
 * L'aggregazione è soltanto di lettura: non fonde e non cancella registrazioni.
 * Omonimie, più email o più schede ufficiali non vengono risolte per ipotesi.
 */
export function groupMemberEvidence<T extends {
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  source: string | null;
  tableId: string | null;
}>(rows: readonly T[]): T[][] {
  const byEmail = new Map<string, T[]>();
  const withoutEmail = new Map<string, T[]>();
  const unidentifiable: T[][] = [];
  for (const row of rows) {
    const email = normalizeMembershipEmail(row.email);
    if (email.includes("@")) {
      const name = normalizeMembershipNameKey(row.first_name, row.last_name);
      // Un indirizzo condiviso da due nomi differenti non prova identità.
      const key = `${email}|${name}`;
      byEmail.set(key, [...(byEmail.get(key) ?? []), row]);
    } else {
      const name = normalizeMembershipNameKey(row.first_name, row.last_name);
      if (name) withoutEmail.set(name, [...(withoutEmail.get(name) ?? []), row]);
      else if (row.tableId) unidentifiable.push([row]);
    }
  }

  const groups: T[][] = [...byEmail.values()];
  const emailGroupsByName = new Map<string, T[][]>();
  for (const group of groups) {
    for (const name of new Set(group.map(row => normalizeMembershipNameKey(row.first_name, row.last_name)))) {
      if (name) emailGroupsByName.set(name, [...(emailGroupsByName.get(name) ?? []), group]);
    }
  }
  for (const [name, unnamedEmail] of withoutEmail) {
    const matching = emailGroupsByName.get(name) ?? [];
    const officialCount = unnamedEmail.filter(row => row.source === "official_members_book").length;
    const manualCount = unnamedEmail.filter(row => row.source === "manual_override").length;
    const unique = officialCount <= 1 && manualCount <= 1;
    if (unique && matching.length === 1) {
      matching[0].push(...unnamedEmail);
    } else if (unique && matching.length === 0) {
      groups.push(unnamedEmail);
    } else {
      for (const row of unnamedEmail) groups.push([row]);
    }
  }
  return [...groups, ...unidentifiable];
}
