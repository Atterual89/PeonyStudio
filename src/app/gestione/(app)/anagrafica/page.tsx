import Link from "next/link";
import { requireOrganizer } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { SharedDirectory } from "@/components/gestionale/SharedDirectory";
import { AleContactsManager } from "@/components/gestionale/AleContactsManager";

export default async function AnagraficaPage() {
  await requireOrganizer();
  const db = getGestionaleDb();

  const { data: bookings, error: bookingsError } = await db.from("gw_bookings")
    .select("id,workshop_id,created_by,gw_workshops(name)")
    .is("deleted_at", null)
    .limit(10000);
  if (bookingsError) throw new Error("Impossibile caricare i corsi.");
  const bookingIds = (bookings ?? []).map(b => b.id);
  const workshopNames = new Map((bookings ?? []).map(b => {
    const w = Array.isArray(b.gw_workshops) ? b.gw_workshops[0] : b.gw_workshops;
    return [b.id, w?.name ?? "Workshop"];
  }));
  type Part = { person_id: string; booking_id: string; entered_as: string | null; entered_email: string | null };
  const participants: Part[] = [];
  for (let i = 0; i < bookingIds.length; i += 150) {
    const { data, error } = await db.from("gw_booking_participants")
      .select("person_id,booking_id,entered_as,entered_email")
      .in("booking_id", bookingIds.slice(i,i+150))
      .is("deleted_at", null).is("removed_at", null).limit(10000);
    if (error) throw new Error("Impossibile caricare i partecipanti.");
    participants.push(...(data ?? []));
  }
  const ids = [...new Set(participants.map(p => p.person_id).filter(Boolean))];
  type PersonRow = {
    id: string; version: number; first_name: string | null; last_name: string | null;
    nickname: string | null; email: string | null; instagram: string | null; phone: string | null;
  };
  const people: PersonRow[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await db.from("gw_people")
      .select("id,version,first_name,last_name,nickname,email,instagram,phone")
      .in("id", ids.slice(i,i+150)).is("merged_into", null).is("deleted_at", null);
    if (error) throw new Error("Impossibile caricare l'anagrafica.");
    people.push(...(data ?? []));
  }
  const directory = people.map(p => {
    const linked = participants.filter(x => x.person_id === p.id);
    const names = [...new Set(linked.map(x => workshopNames.get(x.booking_id)).filter((v): v is string => Boolean(v)))];
    return { ...p, courses: names, enteredEmails: [...new Set(linked.map(x => x.entered_email).filter((v): v is string => Boolean(v)))],
      enteredNames: [...new Set(linked.map(x => x.entered_as).filter((v): v is string => Boolean(v)))] };
  }).sort((a,b) => [a.last_name,a.first_name,a.nickname].filter(Boolean).join(" ").localeCompare([b.last_name,b.first_name,b.nickname].filter(Boolean).join(" "),"it"));

  return <section className="max-w-4xl space-y-3">
    <Link prefetch={false} href="/gestione" className="text-sm underline">← Workshop</Link>
    <h1 className="font-serif text-xl">Anagrafica Alessandra</h1>
    <p className="text-sm text-[#5f524c]">Gestisci i contatti dei clienti e i dati per le fatture. Gli admin confermeranno gli abbinamenti con l'anagrafica comune; modulo e quote non vengono modificati.</p>
    <AleContactsManager />
    <details className="rounded-xl border border-[#211815]/15 bg-white/70 p-3">
      <summary className="cursor-pointer py-1 font-semibold">Persone già inserite nei workshop ({directory.length})</summary>
      <p className="mt-2 text-xs text-[#5f524c]">Queste sono le persone usate dalle iscrizioni ai corsi. Puoi aggiornare i recapiti senza confermare un'associazione o una quota.</p>
      <div className="mt-3"><SharedDirectory people={directory}/></div>
    </details>
  </section>;
}
