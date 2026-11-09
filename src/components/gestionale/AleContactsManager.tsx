"use client";

import {useEffect,useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {
  previewAleFileAction,importAleFileAction,listAleContactsAction,updateAleContactAction,
  type AleContact,
} from "@/app/gestione/(app)/anagrafica/ale-actions";

type Preview={headers:string[];sample:string[][];total:number;suggest:{name:string;email:string}};
const inputStyle="min-h-10 w-full rounded-lg border border-[#211815]/20 bg-white px-3 text-sm";
const actionStyle="min-h-10 rounded-lg border border-[#a8583e] px-3 text-sm font-semibold text-[#a8583e] disabled:opacity-50";

export function AleContactsManager(){
  const router=useRouter();
  const [file,setFile]=useState<File|null>(null);
  const [preview,setPreview]=useState<Preview|null>(null);
  const [nameColumn,setNameColumn]=useState("");
  const [emailColumn,setEmailColumn]=useState("");
  const [contacts,setContacts]=useState<AleContact[]>([]);
  const [search,setSearch]=useState("");
  const [view,setView]=useState<"all"|"unmatched"|"matched">("all");
  const [expanded,setExpanded]=useState<string|null>(null);
  const [draft,setDraft]=useState<AleContact|null>(null);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [pending,startTransition]=useTransition();
  async function reload(){
    const r=await listAleContactsAction();
    if(r.ok)setContacts(r.data);
    else setError(r.error);
  }
  useEffect(() => {
    void reload();
  }, []);

  function inspect(){
    if(!file)return;
    setError("");setMessage("");
    startTransition(async()=>{
      const form=new FormData();form.set("file",file);
      const r=await previewAleFileAction(form);
      if(!r.ok){setError(r.error);return;}
      setPreview(r.data);setNameColumn(r.data.suggest.name);setEmailColumn(r.data.suggest.email);
    });
  }
  function importFile(){
    if(!file||!preview||nameColumn===""){setError("Seleziona la colonna Denominazione.");return;}
    setError("");setMessage("");
    startTransition(async()=>{
      const form=new FormData();
      form.set("file",file);form.set("name",nameColumn);form.set("email",emailColumn);
      const r=await importAleFileAction(form);
      if(!r.ok){setError(r.error);return;}
      setMessage(`Importati ${r.data.created} contatti · ${r.data.updated} aggiornati · ${r.data.skipped} non validi. Nessun abbinamento automatico.`);
      setFile(null);setPreview(null);await reload();router.refresh();
    });
  }
  function save(){
    if(!draft)return;
    setError("");setMessage("");
    startTransition(async()=>{
      const r=await updateAleContactAction({
        id:draft.id,displayName:draft.displayName,email:draft.email,fields:draft.fields,
      });
      if(!r.ok){setError(r.error);return;}
      setExpanded(null);setDraft(null);setMessage("Contatto aggiornato.");
      await reload();router.refresh();
    });
  }
  const filtered=contacts.filter(c=>{
    const status=view==="all"||(view==="matched"?c.matched:!c.matched);
    const q=search.trim().toLocaleLowerCase("it");
    return status&&(!q||[c.displayName,c.email,...Object.values(c.fields)].join(" ").toLocaleLowerCase("it").includes(q));
  });
  return <div className="space-y-3">
    <details className="rounded-xl border border-[#211815]/15 bg-white p-3">
      <summary className="cursor-pointer py-1 text-sm font-semibold">Importa o aggiorna da Excel / CSV</summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-[#5f524c]">Per il file clienti: usa «Denominazione» e «Indirizzo e-mail». Non serve dividere nomi e cognomi. Le altre colonne fiscali restano disponibili nella tua area. Importare non collega automaticamente persone o soci.</p>
        <input type="file" aria-label="File anagrafica clienti" accept=".xlsx,.csv,.tsv" className="w-full text-sm"
          onChange={e=>{setFile(e.target.files?.[0]||null);setPreview(null);setError("");}}/>
        {file&&<button type="button" onClick={inspect} disabled={pending} className={actionStyle}>Leggi file</button>}
        {preview&&<div className="space-y-3 border-t border-[#211815]/10 pt-3">
          <p className="font-semibold text-sm">{preview.total} righe trovate</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ["Denominazione",nameColumn,setNameColumn],
              ["Email (facoltativa)",emailColumn,setEmailColumn],
            ] as const).map(([label,value,setValue])=><label key={label} className="text-sm font-medium">{label}
              <select value={value} onChange={e=>setValue(e.target.value)} className={inputStyle}>
                <option value="">Non selezionata</option>
                {preview.headers.map((h,i)=><option key={i} value={String(i)}>{h}</option>)}
              </select>
            </label>)}
          </div>
          <div className="overflow-x-auto text-xs">
            <table className="min-w-full text-left">
              <thead><tr>{preview.headers.slice(0,9).map((h,i)=><th key={i} className="border-b p-1.5">{h}</th>)}</tr></thead>
              <tbody>{preview.sample.map((row,i)=><tr key={i}>
                {row.slice(0,9).map((value,j)=><td key={j} className="border-b p-1.5">{value||"—"}</td>)}
              </tr>)}</tbody>
            </table>
          </div>
          <button type="button" className="min-h-10 rounded-lg bg-[#a8583e] px-4 text-sm font-semibold text-white disabled:opacity-50"
            disabled={pending||nameColumn===""} onClick={importFile}>Importa senza abbinare</button>
        </div>}
      </div>
    </details>
    {message&&<p role="status" className="rounded-lg bg-[#eef6ee] p-3 text-sm text-[#326941]">{message}</p>}
    {error&&<p role="alert" className="rounded-lg bg-[#fff1f0] p-3 text-sm text-[#9b2c2c]">{error}</p>}
    <div className="space-y-2">
      <h2 className="font-semibold">Contatti di Alessandra · {contacts.length}</h2>
      <p className="text-xs text-[#5f524c]">Puoi aggiornare nome, email e dati fiscali. Solo l'admin può confermare a quale persona del gestionale comune corrispondono.</p>
      <input type="search" placeholder="Cerca nome, email, indirizzo o dato fiscale"
        aria-label="Cerca contatti di Alessandra" value={search} onChange={e=>setSearch(e.target.value)}
        className={inputStyle}/>
      <label className="block text-sm">Mostra
        <select className={inputStyle+" ml-2"} aria-label="Filtra contatti per stato"
          value={view} onChange={e=>setView(e.target.value as "all"|"unmatched"|"matched")}>
          <option value="all">Tutti ({contacts.length})</option>
          <option value="unmatched">Da abbinare ({contacts.filter(c=>!c.matched).length})</option>
          <option value="matched">Collegati ({contacts.filter(c=>c.matched).length})</option>
        </select>
      </label>
      <ul className="divide-y rounded-xl border border-[#211815]/10 bg-white">
        {filtered.slice(0,150).map(c=><li key={c.id} className="p-3">
          <button type="button" className="flex w-full items-center justify-between gap-2 text-left"
            onClick={()=>{const open=expanded!==c.id;setExpanded(open?c.id:null);setDraft(open?{...c,fields:{...c.fields}}:null);}}
            aria-expanded={expanded===c.id}>
            <span className="min-w-0">
              <span className="block break-words font-semibold">{c.displayName}</span>
              <span className="block break-all text-xs text-[#5f524c]">{c.email||"Email non presente"}</span>
            </span>
            <span className="shrink-0 text-xs text-[#5f524c]">{c.matched?"Collegato":"Da abbinare"}</span>
          </button>
          {expanded===c.id&&draft&&<div className="mt-3 space-y-3 border-t border-[#211815]/10 pt-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-sm">Denominazione
                <input className={inputStyle} value={draft.displayName}
                  onChange={e=>setDraft({...draft,displayName:e.target.value})}/></label>
              <label className="text-sm">Email
                <input type="email" className={inputStyle} value={draft.email}
                  onChange={e=>setDraft({...draft,email:e.target.value})}/></label>
            </div>
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-[#a8583e]">Dati fiscali e indirizzi</summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {Object.entries(draft.fields).filter(([key])=>!key.startsWith("__")&&
                  key!=="Denominazione"&&key!=="Indirizzo e-mail").map(([key,value])=>
                  <label key={key} className="text-xs">{key}
                    <input className={inputStyle} value={value}
                      onChange={e=>setDraft({...draft,fields:{...draft.fields,[key]:e.target.value}})}/></label>)}
              </div>
            </details>
            <div className="flex gap-2">
              <button type="button" disabled={pending} onClick={save} className={actionStyle}>Salva modifiche</button>
              <button type="button" onClick={()=>{setExpanded(null);setDraft(null);}} className="text-sm underline">Annulla</button>
            </div>
          </div>}
        </li>)}
      </ul>
      {filtered.length>150&&<p className="text-xs">Mostrati 150 di {filtered.length} contatti. Restringi la ricerca.</p>}
      {!filtered.length&&<p className="text-sm text-[#5f524c]">Nessun contatto per questa ricerca.</p>}
    </div>
  </div>;
}
