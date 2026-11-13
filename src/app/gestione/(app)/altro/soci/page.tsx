export const maxDuration = 120;

import { Suspense } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { MemberLinkReview } from "@/components/gestionale/MemberLinkReview";
import { PaymentEmailReview } from "@/components/gestionale/PaymentEmailReview";
import { PaymentCausaleConflicts } from "@/components/gestionale/PaymentCausaleConflicts";
import { CompleteAllFromMembers } from "@/components/gestionale/CompleteAllFromMembers";
import { RefreshMembershipButton } from "@/components/gestionale/QuotaOk";
import { UpdateAllSourcesButton } from "@/components/gestionale/UpdateAllSourcesButton";
import { AssociationMailSyncControl } from "@/components/gestionale/AssociationMailSyncControl";
import { Notice, buttonClass } from "@/components/gestionale/ui";
import { getAssociationMailState } from "@/app/gestione/(app)/quote-email/actions";
import { loadGoogleFormReviewAction } from "@/app/gestione/(app)/altro/soci/revisione/actions";
import { membershipPeriodFor, membershipPeriodForPayment } from "@/lib/association/membership-periods";
import { paymentStepCounts, stepState, type StepState } from "@/lib/gestionale/verifiche-steps";
import { todayInRome } from "@/lib/gestionale/workshops";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { gmailConnectionStatus } from "@/lib/gestionale/server/payment-gmail-oauth";
import { findMemberLinkProposals } from "@/lib/gestionale/server/member-links";
import { listCompletablePeople } from "@/lib/gestionale/server/member-fill";

// Verifiche: un percorso in cinque passi, da fare in ordine. Ogni passo dice
// quanto resta e ha una sola azione principale; quando è a zero diventa verde.

const BADGE: Record<StepState, string> = {
  done: "bg-[#326941] text-white",
  todo: "bg-[#a8583e] text-white",
  unknown: "bg-[#e7dfd2] text-[#4a3d36]",
};
const CHIP: Record<StepState, string> = {
  done: "bg-[#e3efe5] text-[#264f31]",
  todo: "bg-[#f6e7c8] text-[#5e3f0d]",
  unknown: "bg-[#efe8dc] text-[#4a3d36]",
};

function Step({ n, title, state, chip, text, id, children }: {
  n: number; title: string; state: StepState; chip: string | null; text: string; id?: string; children?: React.ReactNode;
}) {
  return (
    <section id={id} className="flex gap-3 rounded-xl border border-[#211815]/10 bg-white/80 p-4" aria-label={`Passo ${n}: ${title}`}>
      <span aria-hidden="true"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${BADGE[state]}`}>
        {state === "done" ? <Check className="h-4 w-4" /> : n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="font-serif text-xl font-medium">{n}. {title}</h2>
          {chip ? <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CHIP[state]}`}>{chip}</span> : null}
        </div>
        <p className="text-sm text-[#5f524c]">{text}</p>
        {children}
      </div>
    </section>
  );
}

function StepLoading({ n, title }: { n: number; title: string }) {
  return <Step n={n} title={title} state="unknown" chip="Conteggio…" text="Sto contando cosa resta da fare." />;
}

const timeFormat = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const when = (value: string | null | undefined) => (value ? timeFormat.format(new Date(value)) : "mai");

async function UpdateStep() {
  const db = getGestionaleDb();
  const [gmail, mail, tt] = await Promise.all([
    gmailConnectionStatus(),
    db.from("gw_payment_sync_state").select("last_success_at").eq("source", "gmail_payments").maybeSingle(),
    db.from("gw_payment_sync_state").select("last_success_at").eq("source", "ticket_tailor:all").maybeSingle(),
  ]);
  return (
    <Step n={1} title="Aggiorna i dati" state="unknown" chip={null}
      text="Legge in un colpo solo moduli Google, email delle quote e biglietti Ticket Tailor. I moduli chiari si collegano da soli alla scheda giusta, o la creano.">
      <UpdateAllSourcesButton gmailConnected={gmail.connected} />
      <p className="text-xs text-[#5f524c]">
        Ultimo aggiornamento · email quote: {when(mail.data?.last_success_at)} · Ticket Tailor: {when(tt.data?.last_success_at)}
      </p>
      {!gmail.connected ? <AssociationMailSyncControl /> : null}
    </Step>
  );
}

async function FormsStep() {
  const queue = await loadGoogleFormReviewAction();
  const count = queue.ok ? queue.cases.length : null;
  const state = stepState(count);
  return (
    <Step n={2} title="Persone da chiarire" state={state}
      chip={count === null ? "Moduli non leggibili" : count ? `${count} da fare` : "Niente da fare"}
      text="Restano qui solo i dubbi: lo stesso nome con email diverse, più schede possibili per un modulo, moduli registrati due volte.">
      {!queue.ok ? <Notice tone="error">{queue.error}</Notice> : null}
      <Link prefetch={false} href="/gestione/altro/soci/revisione"
        className={count ? buttonClass.primary : buttonClass.secondary}>
        {count ? "Chiarisci uno per uno" : "Rivedi"}
      </Link>
    </Step>
  );
}

async function PaymentsStep({ open }: { open: boolean }) {
  const mail = await getAssociationMailState().catch((error: unknown) => {
    console.error("[soci] Pagamenti Gmail", error instanceof Error ? error.message : error);
    return { ok: false as const, error: "Impossibile caricare i pagamenti. Riprova." };
  });
  const counts = mail.ok ? paymentStepCounts(mail.payments) : null;
  const state = stepState(counts?.toAssign ?? null);
  const today = todayInRome();
  const periods = Array.from({ length: Math.max(1, Number(today.slice(0, 4)) - 2025 + 2) },
    (_, i) => membershipPeriodFor(`${2025 + i}-12-31`))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .filter((p, i, all) => all.findIndex((other) => other.paymentsFrom === p.paymentsFrom) === i)
    .map((p) => ({ from: p.paymentsFrom, label: p.validUntil.startsWith("2026") ? "2025/26" : p.validUntil.slice(0, 4) }));
  return (
    <Step id="quote-email" n={3} title="Quote da assegnare" state={state}
      chip={counts === null ? "Non disponibile" : counts.toAssign ? `${counts.toAssign} da fare` : "Niente da fare"}
      text="Pagamenti letti dalle email: per ognuno scegli a chi va la quota, oppure segnalalo come «non è una quota».">
      {counts?.waitingForm ? (
        <p className="text-xs text-[#5f524c]">
          Altri {counts.waitingForm} aspettano che la persona compili il modulo: non serve fare nulla, si sbloccano da soli al prossimo aggiornamento.
        </p>
      ) : null}
      {!mail.ok ? <Notice tone="error">{mail.error}</Notice> : (
        <details open={open || undefined} className="rounded-lg border border-[#211815]/10 bg-white/70 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-[#a8583e]">
            {counts?.toAssign ? "Assegna le quote" : "Apri i pagamenti"}
          </summary>
          <div className="mt-3 space-y-3">
            <Suspense fallback={<p className="text-xs text-[#5f524c]">Confronto causali e assegnazioni…</p>}>
              <PaymentCausaleConflicts />
            </Suspense>
            <PaymentEmailReview payments={mail.payments} periods={periods}
              defaultPeriod={membershipPeriodForPayment(today)?.paymentsFrom ?? "2025-09-01"} />
          </div>
        </details>
      )}
    </Step>
  );
}

async function MatchesStep() {
  const [ale, proposals] = await Promise.all([
    getGestionaleDb().from("gw_ale_contacts").select("id", { count: "exact", head: true }).is("person_id", null),
    findMemberLinkProposals().catch((error: unknown) => {
      console.error("[soci] Proposte di collegamento", error instanceof Error ? error.message : error);
      return null;
    }),
  ]);
  const aleCount = ale.error ? null : ale.count ?? 0;
  const proposalCount = proposals ? proposals.proposals.length : null;
  const total = aleCount === null || proposalCount === null ? null : aleCount + proposalCount;
  const state = stepState(total);
  return (
    <Step n={4} title="Abbinamenti da confermare" state={state}
      chip={total === null ? "Non disponibile" : total ? `${total} da fare` : "Niente da fare"}
      text="Contatti dell'anagrafica di Ale e schede che sembrano la stessa persona del libro soci: conferma o separa.">
      <div className="flex flex-wrap gap-2">
        <Link prefetch={false} href="/gestione/altro/soci/abbinamenti-ale"
          className={aleCount ? buttonClass.primary : buttonClass.secondary}>
          Contatti di Ale{aleCount ? ` · ${aleCount}` : ""}
        </Link>
      </div>
      {proposals && proposals.proposals.length ? (
        <details id="allineamento-anagrafiche" className="rounded-lg border border-[#211815]/10 bg-white/70 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-[#a8583e]">
            Schede e libro soci · {proposals.proposals.length}
          </summary>
          <div className="mt-3"><MemberLinkReview proposals={proposals.proposals} /></div>
        </details>
      ) : null}
      {!proposals ? <Notice tone="error">Impossibile caricare gli abbinamenti con il libro soci. Riprova.</Notice> : null}
    </Step>
  );
}

async function ExtraMaintenance() {
  const completable = await listCompletablePeople().catch((error: unknown) => {
    console.error("[soci] Anagrafiche da completare", error instanceof Error ? error.message : error);
    return null;
  });
  return <>{completable && completable.length > 0 ? <CompleteAllFromMembers count={completable.length} /> : null}</>;
}

export default async function SociPage({ searchParams }: { searchParams: Promise<{ quote?: string; q?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  return (
    <section className="mx-auto max-w-3xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-serif text-2xl font-medium">Verifiche soci</h1>
        <Link prefetch={false} href="/gestione/altro" className="text-sm text-[#5f524c] underline">Altre impostazioni</Link>
      </div>
      <p className="text-sm text-[#5f524c]">
        Segui i passi in ordine. Quando un passo è a zero passa al successivo: alla fine sai chi non è in regola.
      </p>

      <Suspense fallback={<StepLoading n={1} title="Aggiorna i dati" />}><UpdateStep /></Suspense>
      <Suspense fallback={<StepLoading n={2} title="Persone da chiarire" />}><FormsStep /></Suspense>
      <Suspense fallback={<StepLoading n={3} title="Quote da assegnare" />}><PaymentsStep open={params.quote === "1"} /></Suspense>
      <Suspense fallback={<StepLoading n={4} title="Abbinamenti da confermare" />}><MatchesStep /></Suspense>

      <Step n={5} title="Chi non è in regola" state="unknown" chip={null}
        text="Il risultato: l'elenco di tutte le persone con modulo e quota. Filtra chi non ha il modulo (anche chi ha pagato senza compilarlo) o chi non ha la quota dell'anno, e da lì prendi le email.">
        <Link prefetch={false} href="/gestione/altro/soci/controllo" className={buttonClass.primary}>
          Apri il controllo associazione
        </Link>
      </Step>

      <details className="rounded-xl border border-dashed border-[#211815]/20 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-[#5f524c]">Strumenti avanzati (raramente servono)</summary>
        <div className="mt-3 space-y-3 text-sm">
          <p>
            <Link prefetch={false} href="/gestione/altro/soci/confronto" className="font-semibold text-[#a8583e] underline">Confronto stato soci</Link>
            {" "}— confronta il calcolo vecchio con quello nuovo nelle pagine evento.
          </p>
          <p>
            <Link prefetch={false} href={`/gestione/persone${typeof params.q === "string" ? `?q=${encodeURIComponent(params.q.slice(0, 100))}` : ""}`}
              className="font-semibold text-[#a8583e] underline">Apri anagrafiche</Link>
            {" "}— l'elenco completo delle persone.
          </p>
          <RefreshMembershipButton />
          <Suspense fallback={<span className="text-xs text-[#5f524c]">Controllo anagrafiche…</span>}>
            <ExtraMaintenance />
          </Suspense>
        </div>
      </details>
    </section>
  );
}
