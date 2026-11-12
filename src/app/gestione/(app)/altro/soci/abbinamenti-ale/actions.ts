"use server";

import {requireAdmin} from "@/lib/gestionale/server/auth";
import {getGestionaleDb} from "@/lib/gestionale/server/db";
import {refreshGestione} from "@/lib/gestionale/server/refresh";
import {isUuidLike} from "@/lib/gestionale/validation";

export type AleMatchRow={
  id:string;displayName:string;email:string;personId:string|null;updatedAt:string|null;
  /** Proposta dal registro dei collegamenti (Fase C, migrazioni 051-052). */
  suggestion:{personId:string;name:string;automatic:boolean;note:string|null}|null;
};
type Result<T>={ok:true;data:T}|{ok:false;error:string};

export async function listAleMatchingAction():Promise<Result<AleMatchRow[]>>{
  await requireAdmin();
  const {data,error}=await getGestionaleDb().from("gw_ale_contacts")
    .select("id,display_name,email,person_id,updated_at")
    .order("display_name").range(0,1999);
  if(error)return {ok:false,error:"Impossibile caricare l'anagrafica di Alessandra."};
  const suggestions=await loadSuggestions();
  return {ok:true,data:(data??[]).map(x=>({
    id:x.id,displayName:x.display_name,email:x.email??"",
    personId:x.person_id??null,updatedAt:x.updated_at,
    suggestion:x.person_id?null:suggestions.get(x.id)??null,
  }))};
}

/**
 * Proposte del registro per i contatti non ancora abbinati: l'abbinamento
 * automatico (email e nome+cognome indicano una sola persona) oppure l'unica
 * persona candidata. Se il registro non risponde, nessuna proposta.
 */
async function loadSuggestions():Promise<Map<string,NonNullable<AleMatchRow["suggestion"]>>>{
  const db=getGestionaleDb();
  const out=new Map<string,NonNullable<AleMatchRow["suggestion"]>>();
  const {data:rows,error}=await db.from("gw_person_sources")
    .select("source_ref,person_id,status,candidate_ids,note")
    .eq("source_kind","contatto_ale").in("status",["automatico","da_confermare"]).range(0,1999);
  if(error||!rows){
    if(error)console.error("Gestionale: proposte contatti Ale non disponibili",error.code);
    return out;
  }
  const pick=rows.map(r=>({
    contactId:r.source_ref as string,
    personId:(r.status==="automatico"?r.person_id:(r.candidate_ids?.length===1?r.candidate_ids[0]:null)) as string|null,
    automatic:r.status==="automatico",note:(r.note as string|null)??null,
  })).filter(r=>r.personId);
  const ids=[...new Set(pick.map(r=>r.personId!))];
  const names=new Map<string,string>();
  for(let i=0;i<ids.length;i+=200){
    const {data:people}=await db.from("gw_people").select("id,first_name,last_name,nickname,email")
      .in("id",ids.slice(i,i+200)).is("deleted_at",null).is("merged_into",null);
    for(const p of people??[]){
      names.set(p.id,[p.first_name,p.last_name].filter(Boolean).join(" ").trim()||p.nickname||p.email||"Persona senza nome");
    }
  }
  for(const r of pick){
    const name=names.get(r.personId!);
    if(name)out.set(r.contactId,{personId:r.personId!,name,automatic:r.automatic,note:r.note});
  }
  return out;
}

/** Conferma in un colpo gli abbinamenti automatici del registro (stesso flusso della conferma singola). */
export async function confirmAutomaticAleMatchesAction():Promise<Result<{confirmed:number;failed:number}>>{
  const operator=await requireAdmin();
  const db=getGestionaleDb();
  const [{data:contacts,error},suggestions]=await Promise.all([
    db.from("gw_ale_contacts").select("id").is("person_id",null).range(0,1999),
    loadSuggestions(),
  ]);
  if(error)return {ok:false,error:"Impossibile caricare l'anagrafica di Alessandra."};
  let confirmed=0,failed=0;
  for(const contact of contacts??[]){
    const suggestion=suggestions.get(contact.id);
    if(!suggestion?.automatic)continue;
    const {error:matchError}=await db.rpc("gw_admin_match_ale_contact",{
      p_admin_id:operator.id,p_contact_id:contact.id,p_person_id:suggestion.personId,
    });
    if(matchError){failed+=1;console.error("Gestionale: conferma abbinamento Ale",matchError.code);}
    else confirmed+=1;
  }
  if(confirmed)refreshGestione();
  return {ok:true,data:{confirmed,failed}};
}

export async function matchAleContactAction(input:{contactId:string;personId:string}):
  Promise<Result<{personId:string}>>{
  const operator=await requireAdmin();
  if(!isUuidLike(input?.contactId)||!isUuidLike(input?.personId))
    return {ok:false,error:"Scegli una persona esistente e conferma l'abbinamento."};
  const {data,error}=await getGestionaleDb().rpc("gw_admin_match_ale_contact",{
    p_admin_id:operator.id,p_contact_id:input.contactId,p_person_id:input.personId,
  });
  if(error){
    if(error.code==="GW409")return {ok:false,error:"Abbinamento già presente o dati fiscali in conflitto. Controlla la scheda prima di procedere."};
    return {ok:false,error:"Non riesco a registrare l'abbinamento. Verifica le persone selezionate."};
  }
  // Non dichiarare successo finché la scrittura confermata dall'RPC
  // non corrisponde al profilo scelto.
  const {data:verified,error:readError}=await getGestionaleDb()
    .from("gw_ale_contacts").select("person_id")
    .eq("id",input.contactId).maybeSingle();
  if(readError||verified?.person_id!==input.personId)
    return {ok:false,error:"Verifica del salvataggio non riuscita. Aggiorna la pagina."};
  refreshGestione();
  return {ok:true,data:{personId:data as string}};
}
