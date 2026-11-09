"use client";

import type {ReactNode} from "react";

/** Intestatario e partner: struttura unica nei biglietti Peony e nei workshop KL.
 * I dati della fonte restano distinti; cambia solo il contenuto delle azioni.
 */
export function UnifiedPersonPanel({
  role,name,alias,badge,email,emailLabel,headerAction,children,
}:{
  role:"holder"|"partner";
  name:ReactNode;
  alias?:ReactNode;
  badge:ReactNode;
  email?:string|null;
  emailLabel?:string;
  headerAction?:ReactNode;
  children:ReactNode;
}){
  return <div className="space-y-2 rounded-xl border border-[#211815]/10 bg-white p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#7a5212]">
        {role==="holder"?"1 · Intestatario":"2 · Partner"}
      </span>
      {headerAction}
    </div>
    <p className="flex flex-wrap items-center gap-2 font-semibold">
      {badge}
      <span className="min-w-0 break-words">{name}</span>
      {alias?<span className="text-sm font-normal text-[#5f524c]">{alias}</span>:null}
    </p>
    <p className={`break-all text-sm ${email?"text-[#5f524c]":"font-medium text-[#9b2c2c]"}`}>
      {email ? <>{emailLabel?<span className="mr-1 text-xs">{emailLabel}</span>:null}{email}</> : "Email mancante"}
    </p>
    {children}
  </div>;
}
