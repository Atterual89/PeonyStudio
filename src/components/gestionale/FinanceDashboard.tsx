import type { AccountsData } from "@/lib/gestionale/accounts";
import { cashFlowBars } from "@/lib/gestionale/finance-dashboard";
import { formatCents } from "@/lib/gestionale/format";

function Value({title,cents,emphasis}:{title:string;cents:number;emphasis?:boolean}){
  return (
    <div className="min-w-0 rounded-xl border border-[#211815]/10 bg-white/85 p-3">
      <dt className="text-xs font-medium text-[#5f524c]">{title}</dt>
      <dd className={`mt-1 break-words text-lg font-semibold tabular-nums ${emphasis?"text-[#a8583e]":cents<0?"text-[#9b2c2c]":""}`}>
        {formatCents(cents)}
      </dd>
    </div>
  );
}

function Progress({label,pct,caption,tone="accent"}:{
  label:string;pct:number;caption:string;tone?:"accent"|"warning";
}) {
  const bounded=Math.max(0,Math.min(100,pct));
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold">{label}</span>
        <span className="text-xs font-semibold tabular-nums">{bounded}%</span>
      </div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={bounded} className="h-2.5 overflow-hidden rounded-full bg-[#211815]/10">
        <div className={`h-full rounded-full ${tone==="warning"?"bg-[#b7791f]":"bg-[#a8583e]"}`}
          style={{width:`${bounded}%`}} />
      </div>
      <p className="text-xs text-[#5f524c]">{caption}</p>
    </div>
  );
}

/** Panoramica unica del WS: non ripetere gli stessi numeri nei riepiloghi. */
export function FinanceDashboard({data}:{data:AccountsData}){
  const {recap,settlement}=data;
  const bars=cashFlowBars({
    collectedCents:settlement.ricavi,
    outstandingCents:recap.daIncassare,
    expenseCents:settlement.spese,
  });
  return (
    <section aria-label="Panoramica economica del workshop" className="space-y-3">
      <dl className="grid grid-cols-2 gap-2">
        <Value title="Incassato" cents={settlement.ricavi}/>
        <Value title="Da incassare" cents={recap.daIncassare} emphasis/>
        <Value title="Spese" cents={settlement.spese}/>
        <Value title="Guadagno" cents={settlement.utile}/>
      </dl>
      <div className="space-y-3 rounded-xl border border-[#211815]/10 bg-white/65 p-3">
        <Progress label="Incassi ricevuti" pct={bars.collectedPct}
          caption={bars.hasExpected
            ?"Incassato rispetto al totale previsto delle iscrizioni attive."
            :"Nessuna quota ancora prevista."}/>
        <Progress label="Spese rispetto all'incassato" pct={bars.spentPct}
          tone={bars.costsOverCollected?"warning":"accent"}
          caption={bars.costsOverCollected
            ?"Le spese superano quanto incassato finora."
            :"Parte degli incassi già utilizzata per le spese."}/>
        {data.outstanding.senzaQuota>0?(
          <p className="text-xs font-semibold text-[#9b4b1e]">
            {data.outstanding.senzaQuota} {data.outstanding.senzaQuota===1?"iscrizione senza quota":"iscrizioni senza quota"}: non incluse nel previsto.
          </p>
        ):null}
      </div>
    </section>
  );
}
