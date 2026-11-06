"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { markGroupSentAction } from "@/app/gestione/(app)/w/contact-actions";
import { markEmailSentAction } from "@/app/gestione/(app)/w/email-actions";
import type { EmailRecipient } from "@/lib/gestionale/email/recipients";
import { membershipRequestEmail } from "@/lib/gestionale/email/membership-request";
import { partnerUnknownEmail } from "@/lib/gestionale/email/partner-unknown";
import { membershipReminderEmail, partnerReminderEmail } from "@/lib/gestionale/email/reminder";
import { workshopDetailsEmail } from "@/lib/gestionale/email/workshop-details";
import type { WorkshopEmailData } from "@/lib/gestionale/email/types";
import { buttonClass, cardClass, inputClass, Notice } from "./ui";

export type EmailWorkflowKind = "membership_request" | "membership_reminder" | "partner" | "partner_reminder" | "workshop_details";
const TITLES: Record<EmailWorkflowKind,string> = {
  membership_request: "Richiesta di associazione",
  partner: "Partner da conoscere",
  membership_reminder: "Sollecito associazione",
  partner_reminder: "Sollecito partner",
  workshop_details: "Dettagli del workshop",
};

type Props = {
  kind: EmailWorkflowKind;
  recipients: EmailRecipient[];
  workshopId: string;
  today: string;
  fields: WorkshopEmailData;
  validUntil: string;
  renewalUntil: string;
  initiallyOpen?: boolean;
};

function primaryVariant(row: EmailRecipient): string {
  // Per richieste/solleciti associativi non mischiare testi che citano il partner in modo diverso.
  return row.partnerStatus || "unknown";
}

function proposedSelection(kind: EmailWorkflowKind, recipients: EmailRecipient[]): string[] {
  if (!kind.startsWith("membership")) return recipients.filter((r)=>Boolean(r.email)).map((r)=>r.personId);
  const first = recipients.find((r)=>r.email);
  return first ? recipients.filter((r)=>r.email && primaryVariant(r)===primaryVariant(first)).map((r)=>r.personId) : [];
}

export function EmailWorkflow({ kind, recipients, workshopId, today, fields, validUntil, renewalUntil, initiallyOpen = false }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(() => proposedSelection(kind, recipients));
  const [open, setOpen] = useState(initiallyOpen);
  const [showPeople, setShowPeople] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sentOn, setSentOn] = useState(today);
  const [copied, setCopied] = useState<"bcc" | "subject" | "html" | null>(null);
  const [copyFallback, setCopyFallback] = useState(false);
  const [message, setMessage] = useState<{ tone:"error"|"success"; text:string } | null>(null);
  const [pending, startTransition] = useTransition();
  const chosen = recipients.filter((r)=>selected.includes(r.personId) && r.email);
  const variant = chosen[0] ? primaryVariant(chosen[0]) : "";
  const mixed = kind.startsWith("membership") && chosen.some((r)=>primaryVariant(r)!==variant);
  const emails = [...new Map(chosen.map((r)=>[r.email!.trim().toLowerCase(),r.email!.trim()])).values()];
  const invalidFields = !fields.title.trim() || !fields.dateLabel.trim() ||
    !fields.location.trim() || !fields.intercom.trim() || !fields.membershipDeadline.trim() ||
    !fields.mapsUrl || !fields.membershipFormUrl;
  const detailsIncomplete = kind==="workshop_details" && (
    !fields.schedule?.length || !fields.program?.length || !fields.ropes?.trim() || !fields.clothing?.trim()
  );
  const canPrepare = chosen.length>0 && !mixed && !invalidFields && !detailsIncomplete;
  const subject = kind === "membership_request" ? "Association registration – "+fields.title :
    kind === "membership_reminder" ? "Reminder – association registration – "+fields.title :
    kind === "partner" ? "Your workshop partner – "+fields.title :
    kind === "partner_reminder" ? "Reminder – workshop partner – "+fields.title :
    "Practical information – "+fields.title;

  const html = useMemo(()=>{
    if (!chosen.length || mixed) return "";
    if (kind==="membership_request" || kind==="membership_reminder") {
      const selectedRow = chosen[0];
      const data = { ...fields, partnerStatus: selectedRow.partnerStatus || "unknown", coupleBooking: Boolean(selectedRow.coupleBooking) };
      return kind==="membership_request" ? membershipRequestEmail(data) : membershipReminderEmail(data);
    }
    const data = { ...fields, membershipExpiresOn: validUntil, nextMembershipExpiresOn: renewalUntil };
    if (kind==="partner") return partnerUnknownEmail(data);
    if (kind==="partner_reminder") return partnerReminderEmail(data);
    return workshopDetailsEmail(fields);
  },[fields,kind,chosen.length,variant,mixed,validUntil,renewalUntil]);

  async function copyText(value: string, type: "bcc"|"subject") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(type);setCopyFallback(false);setMessage(null);
    } catch {
      setMessage({tone:"error",text:"Copia non riuscita: seleziona il testo nel riquadro e copialo manualmente."});
      setCopyFallback(true);setCopied(type);
    }
  }

  async function copyHtml() {
    if(!canPrepare) return;
    try {
      if (!navigator.clipboard.write || typeof ClipboardItem === "undefined") throw new Error("HTML clipboard unavailable");
      await navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([html],{type:"text/html"}),
        "text/plain": new Blob([html.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim()],{type:"text/plain"}),
      })]);
      setCopied("html");setCopyFallback(false);setMessage({tone:"success",text:"HTML copiato. Incolla nel corpo di Gmail e controlla il risultato."});
    } catch {
      setCopied(null);
      setCopyFallback(false);
      setMessage({tone:"error",text:"Questo browser non permette di copiare HTML formattato. Usa Gmail da un browser desktop compatibile; il codice non è stato copiato."});
    }
  }

  function markSent() {
    if (!canPrepare || pending) return;
    startTransition(async ()=>{
      const result = kind==="membership_request" || kind==="membership_reminder"
        ? await markGroupSentAction({
            workshopId, group: kind==="membership_request" ? "da_contattare" : "richiesta_inviata",
            personIds: chosen.map((r)=>r.personId), includeInterested:false, sentOn,
          })
        : await markEmailSentAction({
            workshopId,personIds:chosen.map((r)=>r.personId),
            kind:kind==="partner" ? "partner" : kind==="partner_reminder" ? "partner_reminder" : "workshop_details",sentOn,
          });
      setConfirming(false);
      if(result.ok) {
        setMessage({tone:"success",text:"Invio registrato per "+result.data.count+" persone."});
        setSelected([]);setCopied(null);router.refresh();
      } else {
        setMessage({tone:"error",text:result.error});
      }
    });
  }

  return <section className={cardClass+" overflow-hidden"}>
    <button type="button" onClick={()=>setOpen((v)=>!v)} aria-expanded={open}
      className="flex min-h-14 w-full items-center justify-between gap-3 p-3 text-left">
      <span className="font-semibold">{TITLES[kind]}</span>
      <span className="shrink-0 text-sm text-[#5f524c]">{recipients.length ? recipients.length+" da inviare" : "Nessuna"} {open ? "−" : "+"}</span>
    </button>
    {open ? <div className="space-y-3 border-t border-[#211815]/10 p-3 text-sm">
      <div>
        <p className="font-semibold">1. A chi</p>
        <p className="text-[#5f524c]">{chosen.length} persone selezionate · {emails.length} indirizzi unici
          {recipients.some((r)=>!r.email) ? " · Email mancanti" : ""}
        </p>
        <button className="mt-1 min-h-10 text-[#8f2635] underline" type="button" onClick={()=>setShowPeople((v)=>!v)}>
          {showPeople ? "Chiudi elenco" : "Cambia destinatari"}
        </button>
        {showPeople ? <ul className="mt-1 space-y-2">
          {recipients.map((r)=><li key={r.personId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#f2ede3] p-2">
            <label className="flex min-h-10 items-center gap-2">
              <input type="checkbox" className="h-5 w-5" disabled={!r.email} checked={selected.includes(r.personId)&&Boolean(r.email)}
                onChange={(e)=>{setSelected((prev)=>e.target.checked ? [...prev,r.personId] : prev.filter((id)=>id!==r.personId));setCopied(null);setMessage(null)}} />
              <span>{r.name} <span className="block break-all text-xs text-[#5f524c]">{r.email||"Email mancante"} {kind.startsWith("membership") ? "· "+(r.partnerStatus==="unknown"?"partner sconosciuto":"partner noto"):""}</span></span>
            </label>
            {!r.email ? <Link href={"/gestione/p/"+r.personId} className="underline">Completa scheda</Link> : null}
          </li>)}
        </ul> : null}
        {mixed ? <Notice tone="warning">Sono stati selezionati casi con partner diversi. Seleziona solo persone con la stessa situazione: il testo cambia.</Notice> : null}
      </div>
      <div className="border-t border-[#211815]/10 pt-3">
        <p className="font-semibold">2. Prepara l'email HTML</p>
        {invalidFields || detailsIncomplete ? <Notice tone="warning">Completa prima i dettagli del workshop {detailsIncomplete ? "(programma, orari e cosa portare)" : "(dati obbligatori)"} nel riquadro in alto.</Notice> : null}
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <button type="button" disabled={!canPrepare} className={buttonClass.secondary} onClick={()=>void copyText(emails.join(", "),"bcc")}>Copia Ccn ({emails.length})</button>
          <button type="button" disabled={!canPrepare} className={buttonClass.secondary} onClick={()=>void copyText(subject,"subject")}>Copia oggetto</button>
          <button type="button" disabled={!canPrepare} className={buttonClass.primary} onClick={()=>void copyHtml()}>Copia HTML per Gmail</button>
        </div>
        {copied ? <p className="mt-2 text-[#426149]">{copied==="html"?"HTML copiato":copied==="bcc"?"Indirizzi copiati":"Oggetto copiato"} — non equivale a inviare.</p> : null}
        {copyFallback ? <textarea readOnly className={inputClass+" mt-2 min-h-16 w-full"} onFocus={(e)=>e.currentTarget.select()} value={copied==="bcc" ? emails.join(", "):subject} />:null}
        <button type="button" disabled={!canPrepare} className="mt-2 min-h-10 text-[#8f2635] underline" onClick={()=>setShowPreview((v)=>!v)}>{showPreview?"Chiudi anteprima":"Anteprima HTML"}</button>
        {showPreview && canPrepare ? <iframe title={"Anteprima "+TITLES[kind]} sandbox="" srcDoc={html} className="mt-2 h-[470px] w-full rounded-lg border border-[#211815]/10 bg-white" /> : null}
      </div>
      <div className="border-t border-[#211815]/10 pt-3">
        <p className="font-semibold">3. Hai inviato davvero il messaggio?</p>
        <p className="mt-1 text-[#5f524c]">La conferma registra l'invio, non spedisce email.</p>
        {!confirming ? <button type="button" className={buttonClass.secondary+" mt-2"} disabled={!canPrepare||pending} onClick={()=>setConfirming(true)}>Segna come inviata ({chosen.length})</button> :
          <div className="mt-2 space-y-2 rounded-lg bg-[#f2ede3] p-3">
            <label className="block font-medium">Data invio <input className={inputClass+" mt-1 max-w-56"} type="date" value={sentOn} max={today} onChange={(e)=>setSentOn(e.target.value)} /></label>
            <p>Confermi di avere già inviato l'email a {chosen.length} persone?</p>
            <div className="flex flex-wrap gap-2"><button type="button" disabled={pending||!sentOn} className={buttonClass.primary} onClick={markSent}>{pending?"Salvataggio…":"Conferma invio"}</button>
              <button type="button" className={buttonClass.ghost} disabled={pending} onClick={()=>setConfirming(false)}>Chiudi</button></div>
          </div>}
      </div>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    </div> : null}
  </section>;
}
