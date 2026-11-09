"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Result = {ok:true}|{ok:false;error:string};

/** A single immediate quota control: no explanatory copy or confirmation box. */
export function QuotaOkCheckbox({
  checked, editable=true, onToggle,
}:{
  checked:boolean;
  editable?:boolean;
  onToggle:(checked:boolean)=>Promise<Result>;
}){
  const [current,setCurrent]=useState(checked);
  const [pending,startTransition]=useTransition();
  const [error,setError]=useState<string|null>(null);
  const router=useRouter();
  useEffect(()=>{setCurrent(checked);},[checked]);

  return <div className="inline-flex flex-col gap-1">
    <label className={`inline-flex min-h-10 items-center gap-2 text-sm font-semibold ${editable?"cursor-pointer":"cursor-default opacity-70"}`}>
      <input type="checkbox" className="h-5 w-5 accent-[#a8583e]"
        checked={current} disabled={!editable||pending}
        aria-label="Quota OK"
        onChange={event=>{
          const next=event.target.checked;
          setError(null);
          startTransition(async()=>{
            try{
              const result=await onToggle(next);
              if(result.ok){
                setCurrent(next);
                router.refresh();
              }else setError(result.error);
            }catch{
              setError("Salvataggio non riuscito.");
            }
          });
        }}/>
      <span>Quota OK</span>
    </label>
    {error?<span role="alert" className="max-w-xs text-xs text-[#a12c2c]">{error}</span>:null}
  </div>;
}
