"use client";

import type { ReactNode } from "react";

/** L'unica struttura di riga partecipante per Ticket Tailor e Kinbaku LuXuria.
 * La provenienza modifica i dati/azioni interni, mai la gerarchia visiva.
 */
export function UnifiedParticipantCard({
  primary,secondary,expanded,onToggle,actions,footer,children,
}:{
  primary:ReactNode;secondary?:ReactNode;
  expanded:boolean;onToggle:()=>void;
  actions?:ReactNode;footer?:ReactNode;children:ReactNode;
}){
  return <div className="rounded-xl border border-[#211815]/10 bg-white/80 px-3 py-2.5">
    <div className="flex items-start gap-2">
      <button type="button" aria-expanded={expanded} onClick={onToggle}
        className="flex min-h-10 min-w-0 flex-1 items-center justify-between gap-3 text-left">
        <span className="min-w-0 flex-1 space-y-1">
          <span className="block min-w-0 break-words text-sm font-semibold">{primary}</span>
          {secondary?<span className="block text-xs text-[#5f524c]">{secondary}</span>:null}
        </span>
        <span className="shrink-0 text-lg text-[#a8583e]" aria-hidden="true">{expanded?"−":"+"}</span>
      </button>
      {actions?<div className="shrink-0" onClick={event=>event.stopPropagation()}>{actions}</div>:null}
    </div>
    {footer?<div className="mt-1">{footer}</div>:null}
    {expanded?<div className="mt-2 space-y-3 border-t border-[#211815]/10 pt-3 text-sm">{children}</div>:null}
  </div>;
}
