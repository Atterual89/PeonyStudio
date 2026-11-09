/** Un solo indicatore compatto e accessibile in tutto il gestionale.
 * Il testo completo resta come nome accessibile/tooltip e nelle schede.
 */
export type AssociationDotStatus =
  | "verified"
  | "payment_missing"
  | "missing_form"
  | "not_required"
  | "unlinked"
  | "unknown";

const STATUS:Record<AssociationDotStatus,{label:string;style:string}>={
  verified:{label:"Associazione verificata",style:"bg-[#32834b] ring-[#32834b]/20"},
  payment_missing:{label:"Quota associativa da verificare",style:"bg-[#d99b23] ring-[#d99b23]/20"},
  missing_form:{label:"Modulo associativo assente",style:"bg-[#c73535] ring-[#c73535]/20"},
  not_required:{label:"Tessera associativa non richiesta",style:"bg-[#929292] ring-[#929292]/20"},
  unlinked:{label:"Non collegata al libro soci",style:"bg-[#c73535] ring-[#c73535]/20"},
  unknown:{label:"Stato associativo non disponibile",style:"bg-[#929292] ring-[#929292]/20"},
};

export function AssociationStatusDot({status}:{
  status:AssociationDotStatus;
}){
  const info=STATUS[status];
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ${info.style}`}
    role="img" aria-label={info.label} title={info.label}/>;
}

/** Legenda disponibile una sola volta per pagina, non ripetuta su ogni persona. */
export function AssociationDotLegend(){
  const entries: {status:AssociationDotStatus; label:string}[]=[
    {status:"verified",label:"Verificata"},
    {status:"payment_missing",label:"Quota da verificare"},
    {status:"missing_form",label:"Modulo assente"},
    {status:"not_required",label:"Non richiesta"},
  ];
  return <details className="text-xs text-[#5f524c]">
    <summary className="w-fit cursor-pointer py-1 text-[#a8583e]">Legenda pallini</summary>
    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
      {entries.map(entry=><span key={entry.status} className="inline-flex items-center gap-2">
        <AssociationStatusDot status={entry.status}/>{entry.label}
      </span>)}
    </div>
  </details>;
}
