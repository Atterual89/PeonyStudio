import "server-only";
import { getGestionaleDb } from "@/lib/gestionale/server/db";

/** Archivio amministrativo del modulo cartaceo.
 * Questa funzione non crea quote, non aggiorna email e non modifica gw_people.
 */
export async function savePaperFormEvidence(input:{
  person:{id:string;first_name:string|null;last_name:string|null;email:string|null};
  operatorId:string;verified:boolean;date:string;note:string;
}):Promise<{ok:true}|{ok:false;error:string}> {
  const {person}=input;
  const date=input.date;
  const note=input.note;
  const operator={id:input.operatorId};
    const db=getGestionaleDb();
  const sourceRowId="manual_form:person:"+person.id;
  const {data:existing,error:readError}=await db.from("association_members")
    .select("id,membership_status").eq("source","manual_form")
    .eq("source_row_id",sourceRowId).limit(2);
  if(readError||!existing||existing.length>1)
    return {ok:false,error:"Impossibile verificare lo storico del modulo: nessuna modifica eseguita."};
  if(!input.verified&&!existing.length)
    return {ok:false,error:"Non esiste un modulo cartaceo da annullare."};
  const now=new Date().toISOString();
  const payload={
    source:"manual_form",source_row_id:sourceRowId,source_hash:null,
    first_name:person.first_name,last_name:person.last_name,email:person.email,
    membership_status:input.verified?"verified":"revoked",
    membership_starts_at:date,membership_expires_at:null,
    notes_admin:"Modulo cartaceo "+(input.verified?"confermato":"annullato")+" il "+now+
      "; admin "+operator.id+(note?"; nota: "+note:""),
    updated_at:now,
  };
  const result=existing.length
    ? await db.from("association_members").update(payload).eq("id",existing[0].id)
      .eq("source","manual_form").select("id").single()
    : await db.from("association_members").insert(payload).select("id").single();
  if(result.error||!result.data?.id)
    return {ok:false,error:"Il modulo cartaceo non è stato salvato. Nessuna quota modificata."};
  return {ok:true};
}
