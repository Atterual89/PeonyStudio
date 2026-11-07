"use client";

import {useRouter} from "next/navigation";
import {useState,useTransition} from "react";

import {updateTransferAction} from "@/app/gestione/(app)/w/accounts-actions";
import type {Transfer} from "@/lib/gestionale/accounts";
import {centsToInput,formatCents,parseEuroToCents} from "@/lib/gestionale/format";
import {PARTY_LABELS} from "@/lib/gestionale/labels";
import {computeSettlement,type SettlementInput} from "@/lib/gestionale/settlement";
import type {Party} from "@/lib/gestionale/types";

import {Field,InlineConfirm,Notice,buttonClass,inputClass} from "./ui";

export function TransferEditForm({transfer,transfers,input,today,hasCarryovers,onDone}:{
  transfer:Transfer;transfers:readonly Transfer[];input:SettlementInput;today:string;
  hasCarryovers:boolean;onDone:()=>void;
}) {
  const router=useRouter();
  const [amount,setAmount]=useState(centsToInput(transfer.amountCents));
  const [fromParty,setFromParty]=useState<Party>(transfer.fromParty);
  const [status,setStatus]=useState<"eseguito"|"da_eseguire">(transfer.status);
  const [date,setDate]=useState(transfer.executedOn??today);
  const [notes,setNotes]=useState(transfer.notes??"");
  const [confirm,setConfirm]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [pending,startTransition]=useTransition();
  const parsed=parseEuroToCents(amount);
  const toParty=fromParty==="peony"?"redsabbath":"peony";
  const changed=parsed!==transfer.amountCents ||
    fromParty!==transfer.fromParty||status!==transfer.status ||
    (status==="eseguito"&&date!==transfer.executedOn) ||
    notes.trim()!==(transfer.notes??"").trim();
  const before=computeSettlement(input);
  const after=parsed!==null&&parsed>0?computeSettlement({
    ...input,
    transfers:transfers.map(t=>t.id===transfer.id
      ?{fromParty,toParty,amountCents:parsed,status}
      :{fromParty:t.fromParty,toParty:t.toParty,amountCents:t.amountCents,status:t.status})
  }):null;
  function submit(){
    if(!changed||parsed===null||parsed<=0||status==="eseguito"&&!date)return;
    setError(null);
    startTransition(async()=>{
      const r=await updateTransferAction({id:transfer.id,version:transfer.version,
        confirmedImpact:true,fields:{amount,fromParty,status,
          executedOn:status==="eseguito"?date:"",notes}});
      if(!r.ok){setError(r.error);setConfirm(false);return;}
      router.refresh();onDone();
    });
  }
  return (
    <div className="space-y-3 rounded-xl border border-[#b7791f]/25 bg-[#fdf7ed] p-3">
      <p className="font-semibold">Modifica trasferimento registrato</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Da">
          <select className={inputClass} value={fromParty}
            onChange={e=>{setFromParty(e.target.value as Party);setConfirm(false);}}>
            <option value="redsabbath">{PARTY_LABELS.redsabbath}</option>
            <option value="peony">{PARTY_LABELS.peony}</option>
          </select>
        </Field>
        <Field label="A">
          <p className="flex h-10 items-center text-sm font-semibold">{PARTY_LABELS[toParty]}</p>
        </Field>
        <Field label="Importo effettivo (€)">
          <input className={inputClass} inputMode="decimal" value={amount}
            onChange={e=>{setAmount(e.target.value);setConfirm(false);}}
            aria-label="Modifica importo effettivamente trasferito"/>
        </Field>
        <Field label="Stato">
          <select className={inputClass} value={status}
            onChange={e=>{setStatus(e.target.value as "eseguito"|"da_eseguire");setConfirm(false);}}>
            <option value="eseguito">Già versato</option>
            <option value="da_eseguire">Da versare</option>
          </select>
        </Field>
        {status==="eseguito" ? (
          <Field label="Data versamento">
            <input type="date" className={inputClass} value={date}
              onChange={e=>{setDate(e.target.value);setConfirm(false);}}/>
          </Field>
        ):null}
      </div>
      <Field label="Note">
        <input className={inputClass} value={notes}
          onChange={e=>{setNotes(e.target.value);setConfirm(false);}} />
      </Field>
      {after?(
        <div className="space-y-1 text-sm">
          <p>Saldo prima: <strong>{before.residuo===null?"Da ripartire":formatCents(before.residuo)}</strong></p>
          <p>Saldo dopo: <strong>{after.residuo===null?"Da ripartire":formatCents(after.residuo)}</strong></p>
          <p className="text-xs text-[#5f524c]">Saldo positivo: Ale deve a Peony; negativo: Peony deve ad Ale.</p>
        </div>
      ):null}
      {hasCarryovers?(
        <p className="text-sm text-[#7a5212]">
          Attenzione: esistono riporti da o verso questo workshop. La modifica
          ricalcola il saldo corrente, ma non modifica i riporti già registrati:
          è necessario verificarli anche nel workshop collegato.
        </p>
      ):null}
      {confirm?(
        <InlineConfirm
          question={`Confermi la modifica da ${formatCents(transfer.amountCents)} a ${parsed===null?"importo non valido":formatCents(parsed)}?`}
          note="La modifica sarà registrata nello storico e ricalcolerà i conti, le spettanze e il residuo dei workshop interessati. I riporti già registrati vanno ricontrollati separatamente."
          confirmLabel="Confermo la modifica"
          pending={pending} onConfirm={submit} onCancel={()=>setConfirm(false)}
        />
      ):(
        <div className="flex flex-wrap gap-2">
          <button className={buttonClass.primary} type="button"
            disabled={pending||!changed||parsed===null||parsed<=0||(status==="eseguito"&&!date)}
            onClick={()=>{setError(null);setConfirm(true);}}>Salva modifica</button>
          <button className={buttonClass.ghost} type="button" onClick={onDone}>Annulla</button>
        </div>
      )}
      {error?<Notice tone="error">{error}</Notice>:null}
    </div>
  );
}
