import "server-only";
import Link from "next/link";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { suspiciousAllocation } from "@/lib/gestionale/payment-causale-review";

/** Segnalazioni non distruttive: non cancelliamo quote, allocazioni o ricevute. */
export async function PaymentCausaleConflicts(){
  await requireAdmin();
  const db=getGestionaleDb();
  const {data:payments,error}=await db.from("gw_association_payment_emails")
    .select("id,payer_name,amount_cents,paid_at,note")
    .eq("status","confirmed").not("note","is",null)
    .order("paid_at",{ascending:false}).limit(400);
  if(error||!payments)return <p className="text-xs text-[#9b4b1e]">Controllo causali non disponibile.</p>;
  if(!payments.length)return null;
  const ids=payments.map(p=>p.id);
  const {data:allocations,error:allocationError}=await db.from("gw_association_payment_allocations")
    .select("payment_id,person_id,slot").in("payment_id",ids).limit(500);
  if(allocationError)return <p className="text-xs text-[#9b4b1e]">Collegamenti quote non disponibili.</p>;
  const peopleIds=[...new Set((allocations??[]).map(a=>a.person_id).filter((s):s is string=>Boolean(s)))];
  const {data:people,error:peopleError}=peopleIds.length
    ? await db.from("gw_people").select("id,first_name,last_name").in("id",peopleIds)
    : {data:[],error:null};
  if(peopleError)return <p className="text-xs text-[#9b4b1e]">Anagrafiche non disponibili.</p>;
  const byPayment=new Map(payments.map(p=>[p.id,p]));
  const byPerson=new Map((people??[]).map(p=>[p.id,[p.first_name,p.last_name].filter(Boolean).join(" ")]));
  const warnings=(allocations??[]).flatMap(a=>{
    const payment=byPayment.get(a.payment_id);
    const name=a.person_id?byPerson.get(a.person_id):null;
    if(!payment||!name)return [];
    const reason=suspiciousAllocation(payment.note,name);
    return reason?[{id:payment.id,personId:a.person_id,slot:a.slot,payment,name,reason}]:[];
  });
  if(!warnings.length)return null;
  return <details className="rounded-xl border border-[#d5a052]/30 bg-white/80 p-3">
    <summary className="cursor-pointer font-semibold text-[#805b26]">
      Quote già assegnate con causale da ricontrollare ({warnings.length})
    </summary>
    <p className="my-2 text-xs text-[#5f524c]">
      Segnalazioni, non errori certi. Controlla prima di correggere un pagamento:
      non sono state annullate né trasferite quote.
    </p>
    <div className="max-h-[550px] divide-y divide-[#211815]/10 overflow-y-auto">
      {warnings.slice(0,60).map((row,i)=><div key={row.id+"-"+row.slot+"-"+i} className="space-y-1 py-3 text-sm">
        <p className="font-semibold">{row.name} · {row.payment.amount_cents/100} € · {new Date(row.payment.paid_at).toLocaleDateString("it-IT")}</p>
        <p className="text-xs text-[#9b4b1e]">{row.reason}</p>
        <p className="text-xs"><strong>Pagante:</strong> {row.payment.payer_name||"Non identificato"}</p>
        <p className="text-xs"><strong>Causale:</strong> {row.payment.note}</p>
        {row.personId&&<Link prefetch={false} className="inline-flex text-xs text-[#a8583e] underline"
          href={"/gestione/p/"+row.personId}>Apri la scheda della persona</Link>}
      </div>)}
    </div>
  </details>;
}
