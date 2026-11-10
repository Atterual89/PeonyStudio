import "server-only";

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
      .select("last_success_at,checked_through,pending_page_token")
      .eq("source","gmail_payments_history_2024").maybeSingle(),
    db.from("gw_association_payment_emails")
      .select("id,provider,payer_name,paid_at,amount_cents,status")
      .gte("paid_at","2024-01-01T00:00:00Z")
      .order("paid_at",{ascending:false}).range(0,999),
  ]);
  const rows=(payments.data??[]) as EmailPayment[];
  const yearOf=(iso:string)=>new Intl.DateTimeFormat("en-CA",{year:"numeric",timeZone:"Europe/Rome"}).format(new Date(iso));
  const years=["2024","2025","2026"];
  return <section className="space-y-3 rounded-xl border border-[#211815]/10 bg-white/75 p-3">
    <h2 className="font-serif text-lg">3. Analisi dei pagamenti storici</h2>
    <p className="text-sm text-[#5f524c]">
      Le email di PayPal/Qonto sono indizi di pagamento, non quote già assegnate.
      L'analisi parte dal 1° gennaio 2024 e non modifica le validità associative.
    </p>
    <HistoricalMailSyncButton/>
    {mailState.error||payments.error?
      <p role="alert" className="text-sm text-[#9b2c2c]">Impossibile leggere il riepilogo dei pagamenti.</p>:
      <>
        <p className="text-xs text-[#5f524c]">
          {mailState.data?.last_success_at
            ?"Ultimo controllo storico: "+new Date(mailState.data.last_success_at).toLocaleString("it-IT")
            :"Importazione storica non ancora eseguita nel gestionale."}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {years.map(year=>{
            const perYear=rows.filter(row=>yearOf(row.paid_at)===year);
            return <div key={year} className="rounded-lg border border-[#211815]/10 p-3">
              <p className="text-sm font-semibold">{year}</p>
              <p className="text-xl font-semibold tabular-nums">{perYear.length}</p>
              <p className="text-xs text-[#5f524c]">
                {perYear.filter(p=>p.status==="pending").length} da verificare
              </p>
            </div>;
          })}
        </div>
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
          Le notifiche antecedenti al settembre 2025 richiedono una revisione storica:
          non devono essere abbinate automaticamente alle annualità 2026 o 2027.
        </p>
      </>}
  </section>;
}
