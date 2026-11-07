import type { Person } from "./types";
import { displayName, normalizeText } from "./format";
import { normalizeMembershipEmail } from "@/lib/association/membership-state";
import type { SociReviewRow } from "@/lib/gestionale/server/soci";

export type UpcomingContact = {
  key: string;
  name: string;
  email: string | null;
  personId: string | null;
  formMemberId: string | null;
  paid: boolean | null;
  paidSource: "manual" | "book" | null;
  observer: boolean;
  periodDate: string;
};

export type UpcomingPeopleGroup = {
  key: string;
  title: string;
  startsOn: string;
  endsOn: string | null;
  href: string;
  people: UpcomingContact[];
};

export type OtherContact = Omit<UpcomingContact, "periodDate" | "observer">;

export type PeopleOverview = {
  upcoming: UpcomingPeopleGroup[];
  otherPeople: OtherContact[];
  formOnly: OtherContact[];
  totalOthers: number;
};

/** Abbinamento automatico solo per email univoca: mai unire omonimi per errore. */
function uniqueByEmail<T>(values: readonly T[], emailOf: (row: T) => string | null | undefined) {
  const map = new Map<string, T | null>();
  for (const value of values) {
    const key = normalizeMembershipEmail(emailOf(value));
    if (!key) continue;
    map.set(key, map.has(key) ? null : value);
  }
  return (email: string | null | undefined): T | null => {
    const key = normalizeMembershipEmail(email);
    return key ? map.get(key) ?? null : null;
  };
}

export function buildPeopleOverview(input: {
  people: readonly Person[];
  currentForms: readonly SociReviewRow[];
  formsByYear: ReadonlyMap<string, readonly SociReviewRow[]>;
  peony: readonly {
    key: string; title: string; startsOn: string; endsOn: string | null; href: string;
    people: readonly { key: string; name: string; email: string | null; observer: boolean }[];
  }[];
  luxuria: readonly {
    key: string; title: string; startsOn: string; endsOn: string | null; href: string;
    people: readonly { personId: string }[];
  }[];
  today: string;
  query?: string;
}): PeopleOverview {
  const people = input.people.filter((person) => !person.merged_into);
  const byId = new Map(people.map((person) => [person.id, person]));
  const findPerson = uniqueByEmail(people, (row) => row.email);
  const findCurrentForm = uniqueByEmail(input.currentForms, (row) => row.email);
  const formsFor = new Map([...input.formsByYear].map(([year, forms]) =>
    [year, uniqueByEmail(forms, (row) => row.email)] as const,
  ));
  const seenPeople = new Set<string>();
  const seenForms = new Set<string>();
  const query = normalizeText(input.query ?? "");
  const match = (name: string, email: string | null) =>
    !query || normalizeText(name).includes(query) || normalizeText(email).includes(query);

  function contact(name: string, email: string | null, personId: string | null,
    observer: boolean, periodDate: string, key: string): UpcomingContact {
    const form = formsFor.get(periodDate.slice(0, 4))?.(email) ?? null;
    if (personId) seenPeople.add(personId);
    if (form) seenForms.add(form.formMemberId);
    return {
      key, name, email, personId,
      formMemberId: form?.formMemberId ?? null,
      paid: form ? form.paid : null,
      paidSource: form?.paidSource ?? null,
      observer, periodDate,
    };
  }

  const upcoming: UpcomingPeopleGroup[] = [
    ...input.peony.map((event) => ({
      ...event,
      people: event.people.map((person) => {
        const personId = findPerson(person.email)?.id ?? null;
        return contact(person.name, person.email, personId, person.observer, event.startsOn, person.key);
      }),
    })),
    ...input.luxuria.map((event) => ({
      ...event,
      people: event.people.flatMap(({ personId }) => {
        const person = byId.get(personId);
        if (!person) return [];
        return [contact(displayName(person), person.email, personId, false, event.startsOn, `p:${personId}`)];
      }),
    })),
  ].filter((group) => (group.endsOn ?? group.startsOn) >= input.today)
    .map((group) => ({
      ...group,
      people: query && !normalizeText(group.title).includes(query)
        ? group.people.filter((person) => match(person.name, person.email))
        : group.people,
    }))
    .filter((group) => group.people.length > 0)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.title.localeCompare(b.title, "it"));

  // L'elenco delle altre persone non ripete le schede già nei prossimi eventi.
  // I moduli non collegati restano visibili solo in un sottogruppo separato.
  const otherPeople: OtherContact[] = people.filter((person) => !seenPeople.has(person.id))
    .map((person) => {
      const form = findCurrentForm(person.email);
      if (form) seenForms.add(form.formMemberId);
      return {
        key: `p:${person.id}`, name: displayName(person), email: person.email, personId: person.id,
        formMemberId: form?.formMemberId ?? null,
        paid: form ? form.paid : null, paidSource: form?.paidSource ?? null,
      };
    }).filter((person) => match(person.name, person.email))
    .sort((a, b) => a.name.localeCompare(b.name, "it"));

  // Escludi anche i moduli collegati a una scheda che compare nei futuri:
  // se il filtro per ricerca è attivo, il form resta comunque associato alla persona.
  const formOnly: OtherContact[] = input.currentForms.filter((form) =>
    !seenForms.has(form.formMemberId) && !findPerson(form.email),
  ).map((form) => ({
    key: `f:${form.formMemberId}`, name: form.name, email: form.email,
    personId: null, formMemberId: form.formMemberId, paid: form.paid, paidSource: form.paidSource,
  })).filter((person) => match(person.name, person.email))
    .sort((a, b) => a.name.localeCompare(b.name, "it"));

  return { upcoming, otherPeople, formOnly, totalOthers: otherPeople.length + formOnly.length };
}
