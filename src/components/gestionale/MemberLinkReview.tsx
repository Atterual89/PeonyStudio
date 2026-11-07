"use client";

// Fase 5 (/gestione/altro/soci): proposte di collegamento al libro soci.
// Per email: spuntate. Per nome e cognome: da spuntare a mano (conferma
// esplicita). "Conferma selezionati" collega solo le spuntate; il server
// ricalcola le proposte e collega solo quelle ancora uguali.

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { linkMemberProposalsAction } from "@/app/gestione/(app)/w/actions";
import type { LinkProposal } from "@/lib/gestionale/exact-matches";

import { Notice, Section, buttonClass, cardClass } from "./ui";

export function MemberLinkReview({ proposals }: { proposals: LinkProposal[] }) {
  const router=useRouter();
  // Per email preselezionate, per nome no.
  const [checked, setChecked] = useState<Set<string>>(() => new Set(proposals.filter((p) => p.by === "email").map((p) => p.personId)));
  const [message, setMessage] = useState<{ tone: "success" | "warning" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const byEmail = proposals.filter((p) => p.by === "email");
  const byName = proposals.filter((p) => p.by === "nome");
  const picks = proposals.filter((p) => checked.has(p.personId));

  function toggle(id: string, value: boolean) {
    setChecked((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function confirm() {
    setMessage(null);
    startTransition(async () => {
      const result = await linkMemberProposalsAction({ picks: picks.map(({ personId, memberId }) => ({ personId, memberId })) });
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      const { linked, failed } = result.data;
      setChecked(new Set());
      router.refresh();
      setMessage({
        tone: failed ? "warning" : "success",
        text: `${linked === 1 ? "1 persona collegata" : `${linked} persone collegate`}.${failed ? ` ${failed} non riuscite: ricarica e riprova.` : ""}`,
      });
    });
  }

  const list = (items: LinkProposal[]) => (
    <ul className={`${cardClass} divide-y divide-[#211815]/5 text-sm`}>
      {items.map((proposal) => (
        <li key={proposal.personId}>
          <label className="flex min-h-10 items-start gap-3 px-3 py-2">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#a8583e]"
              checked={checked.has(proposal.personId)}
              onChange={(e) => toggle(proposal.personId, e.target.checked)}
            />
            <span className="min-w-0">
              <span className="block">
                <Link prefetch={false} href={`/gestione/p/${proposal.personId}`} className="font-semibold underline">
                  {proposal.personName}
                </Link>{" "}
                → {proposal.memberName}
              </span>
              <span className="block break-all text-[#5f524c]">
                {proposal.personEmail ?? "senza email"}
                {proposal.by === "nome" ? ` · nel libro soci: ${proposal.memberEmail ?? "senza email"}` : null}
              </span>
              {proposal.differentEmail ? <span className="block text-xs font-semibold text-[#7a5212]">email diversa: controlla che sia la stessa persona</span> : null}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );

  return (
    <div>
      <Section title="Stessa email" count={byEmail.length} defaultOpen>
        {byEmail.length === 0 ? <p className="text-sm text-[#5f524c]">Nessuna.</p> : list(byEmail)}
      </Section>
      <Section title="Stesso nome e cognome · da confermare" count={byName.length} defaultOpen>
        {byName.length === 0 ? (
          <p className="text-sm text-[#5f524c]">Nessuna.</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-[#5f524c]">Spunta solo quelle in cui è certamente la stessa persona.</p>
            {list(byName)}
          </>
        )}
      </Section>

      {/* In basso, vicino al pollice. */}
      <div className="sticky bottom-20 z-10 mt-3 space-y-2 rounded-xl bg-[#f2ede3]/95 py-2 backdrop-blur">
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        <button type="button" className={`${buttonClass.primary} w-full sm:w-auto`} disabled={pending || picks.length === 0} onClick={confirm}>
          {pending ? "Collegamento…" : `Conferma selezionati (${picks.length})`}
        </button>
      </div>
    </div>
  );
}
