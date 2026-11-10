import "server-only";
import Link from "next/link";

import { HistoricalMailSyncButton } from "@/components/gestionale/HistoricalMailSyncButton";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";

type EmailPayment={
  id:string;provider:string;payer_name:string|null;paid_at:string;
  amount_cents:number;status:string;
};
export async function HistoricPaymentAudit(){
  await requireAdmin();
  const db=getGestionaleDb();
  const [mailState,payments]=await Promise.all([
    db.from("gw_payment_sync_state")
      .select("last_success_at,checked_through,pending_page_token,pending_window_from,pending_window_until")
      .eq("source","gmail_payments_history_2024").maybeSingle(),
    db.from("gw_association_payment_emails")
      .select("id,provider,payer_name,paid_at,amount_cents,status")
      .gte("paid_at","2025-08-31T22:00:00Z")
      .order("paid_at",{ascending:false}).range(0,999),
  ]);
  const rows=(payments.data??[]) as EmailPayment[];
  const yearOf=(iso:string)=>new Intl.DateTimeFormat("en-CA",{year:"numeric",timeZone:"Europe/Rome"}).format(new Date(iso));
  const currentYear=Number(new Intl.DateTimeFormat("en-CA",{year:"numeric",timeZone:"Europe/Rome"}).format(new Date()));
  const years=Array.from({length:Math.max(1,currentYear-2025+1)},(_,index)=>String(2025+index));
  const isInProgress=Boolean(mailState.data?.pending_page_token);
  const earliestImported=rows.length
    ? new Date(Math.min(...rows.map(row=>new Date(row.paid_at).getTime())))
      .toLocaleDateString("it-IT",{timeZone:"Europe/Rome"})
    : null;
  return <section className="space-y-3 rounded-xl border border-[#211815]/10 bg-white/75 p-3">
    <h2 className="font-serif text-lg">3. Analisi delle quote dal settembre 2025</h2>
    <p className="text-sm text-[#5f524c]">
      Le email di PayPal/Qonto sono indizi di pagamento, non quote già assegnate.
      L'analisi parte dal 1° settembre 2025 e non modifica le validità associative.
    </p>
    <HistoricalMailSyncButton initialHasMore={isInProgress}/>
    {mailState.error||payments.error?
      <p role="alert" className="text-sm text-[#9b2c2c]">Impossibile leggere il riepilogo dei pagamenti.</p>:
      <>
        {isInProgress&&<div role="status" className="space-y-1 rounded-lg border border-[#a8583e]/25 p-3 text-sm">
          <p className="font-semibold">Archivio storico non ancora completo</p>
          <p>Notifiche candidate presenti: {rows.length}{earliestImported?` · prima ricevuta importata: ${earliestImported}`:""}.</p>
          <p>Prosegui con i blocchi Gmail fino alla conferma di completamento, poi verifica le quote candidate.
          Le ricevute precedenti alla prima data visualizzata potrebbero essere ancora da importare.</p>
        </div>}
        <p className="text-xs text-[#5f524c]">
          {mailState.data?.last_success_at
            ?"Ultimo controllo storico: "+new Date(mailState.data.last_success_at).toLocaleString("it-IT")
            :mailState.data?.pending_page_token
              ?"Analisi in corso: puoi proseguire dal punto salvato."
              :"Analisi da settembre 2025 non ancora completata."}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {years.map(year=>{
            const perYear=rows.filter(row=>yearOf(row.paid_at)===year);
            return <div key={year} className="rounded-lg border border-[#211815]/10 p-3">
              <p className="text-sm font-semibold">{year}{year==="2025"?" (set–dic)":""}</p>
              <p className="text-xl font-semibold tabular-nums">{perYear.length}</p>
              <p className="text-xs text-[#5f524c]">
                {perYear.filter(p=>p.status==="pending").length} da verificare
              </p>
            </div>;
          })}
        </div>
        <Link prefetch={false} className="inline-flex min-h-10 items-center rounded-lg border border-[#a8583e]/40 px-3 py-2 text-sm font-semibold text-[#a8583e]" href="/gestione/altro/soci?quote=1#quote-email">
          Rivedi i pagamenti importati e abbinali alle persone
        </Link>
        <details className="rounded-lg border border-[#211815]/10 p-3">
          <summary className="cursor-pointer text-sm font-semibold">Ultimi pagamenti candidati importati</summary>
          <div className="mt-2 divide-y divide-[#211815]/10">
            {rows.slice(0,40).map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
              <div>
                <p className="font-semibold">{p.payer_name||"Pagante non identificato"}</p>
                <p>{new Date(p.paid_at).toLocaleDateString("it-IT")} · {p.provider} · {p.status}</p>
              </div>
              <p className="font-semibold tabular-nums">{(p.amount_cents/100).toLocaleString("it-IT",{style:"currency",currency:"EUR"})}</p>
            </div>)}
            {rows.length===0&&<p className="py-2 text-xs">Nessun pagamento candidato salvato in questo momento.</p>}
          </div>
        </details>
        <p className="text-xs text-[#5f524c]">
          Sono inclusi solo i pagamenti dal 1° settembre 2025. Le notifiche restano
          candidate da verificare: non sono quote confermate automaticamente.
        </p>
      </>}
  </section>;
}
