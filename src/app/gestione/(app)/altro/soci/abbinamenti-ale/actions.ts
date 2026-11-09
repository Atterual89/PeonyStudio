"use server";

import {requireAdmin} from "@/lib/gestionale/server/auth";
import {getGestionaleDb} from "@/lib/gestionale/server/db";
import {refreshGestione} from "@/lib/gestionale/server/refresh";
import {isUuidLike} from "@/lib/gestionale/validation";

export type AleMatchRow={
  id:string;displayName:string;email:string;personId:string|null;updatedAt:string|null;
};
type Result<T>={ok:true;data:T}|{ok:false;error:string};

export async function listAleMatchingAction():Promise<Result<AleMatchRow[]>>{
  await requireAdmin();
  const {data,error}=await getGestionaleDb().from("gw_ale_contacts")
    .select("id,display_name,email,person_id,updated_at")
    .order("display_name").range(0,1999);
  if(error)return {ok:false,error:"Impossibile caricare l'anagrafica di Alessandra."};
  return {ok:true,data:(data??[]).map(x=>({
    id:x.id,displayName:x.display_name,email:x.email??"",
    personId:x.person_id??null,updatedAt:x.updated_at,
  }))};
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
