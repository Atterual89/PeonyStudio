"use server";

import { displayName } from "@/lib/gestionale/format";
import { searchPeople } from "@/lib/gestionale/people";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getRecentWorkshops, loadPeople } from "@/lib/gestionale/server/data";
import type { ActionResult } from "@/lib/gestionale/types";
import { asText } from "@/lib/gestionale/validation";

export type SearchResult = {
  id: string;
  displayName: string;
  fullName: string;
  email: string | null;
  instagram: string | null;
  workshops: { id: string; name: string; startsOn: string }[];
};

export async function globalSearchAction(query: string): Promise<ActionResult<SearchResult[]>> {
  await requireAdmin();
  const text = asText(query, 100).trim();
  if (text.length < 2) return { ok: true, data: [] };

  try {
    const people = searchPeople(await loadPeople(), text, 20);
    const recent = await getRecentWorkshops(people.map((person) => person.id));

    return {
      ok: true,
      data: people.map((person) => ({
        id: person.id,
        displayName: displayName(person),
        fullName: [person.first_name, person.last_name].filter(Boolean).join(" "),
        email: person.email,
        instagram: person.instagram,
        workshops: (recent.get(person.id) ?? []).map((row) => ({
          id: row.workshopId,
          name: row.workshopName,
          startsOn: row.startsOn,
        })),
      })),
    };
  } catch (error) {
    console.error("Gestionale ricerca:", error instanceof Error ? error.message : error);
    return { ok: false, error: "Ricerca non riuscita. Riprova." };
  }
}
