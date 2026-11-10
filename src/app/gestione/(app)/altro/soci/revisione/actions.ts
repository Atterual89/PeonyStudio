"use server";

import { buildAssociationMembersSyncPreview, applyReviewedGoogleFormRow } from "@/lib/association/members-sync";
import { buildGoogleFormReviewQueue, type FormReviewCase } from "@/lib/gestionale/google-form-review";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { loadPeople } from "@/lib/gestionale/server/data";
import { clearMembershipCache } from "@/lib/gestionale/server/membership";
import { refreshGestione } from "@/lib/gestionale/server/refresh";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type QueueResult={ok:true;cases:FormReviewCase[];readCount:number}|
                 {ok:false;error:string};
export async function loadGoogleFormReviewAction():Promise<QueueResult>{
  await requireAdmin();
  try{
    const db=createSupabaseAdminClient();
    const [preview,people,membersResponse]=await Promise.all([
      buildAssociationMembersSyncPreview(db),loadPeople(),
      db.from("association_members")
        .select("id,source,source_row_id,first_name,last_name,email,membership_status,contact,membership_starts_at,membership_expires_at")
        .in("source",["google_sheet","manual_override","manual_form"]).order("id").range(0,9999),
    ]);
    if(membersResponse.error)throw new Error(membersResponse.error.message);
    if(preview.errors.length||preview.validRows<Math.max(1,Math.floor(preview.totalRows*.7)))
      throw new Error("La lettura Google è incompleta: non è stata applicata alcuna modifica.");
    const cases=buildGoogleFormReviewQueue({
      preview,members:membersResponse.data??[],people,
    });
    return {ok:true,cases,readCount:preview.validRows};
  }catch(error){
    console.error("[soci] Revisione moduli Google non disponibile",error);
    return {ok:false,error:"Impossibile completare la lettura dei moduli Google. Nessun dato modificato: controlla i fogli e riprova."};
  }
}

export async function confirmReviewedGoogleFormAction(
  sourceRowId:string,sourceHash:string
):Promise<{ok:true;message:string}|{ok:false;error:string}>{
  await requireAdmin();
  try{
    const db=createSupabaseAdminClient();
    const result=await applyReviewedGoogleFormRow(db,sourceRowId,sourceHash);
    await clearMembershipCache();
    refreshGestione();
    return {ok:true,message:
      result.kind==="created"?"Modulo Google importato. Verifica che la persona sia collegata all'anagrafica.":
      result.kind==="updated"?"Modulo Google aggiornato senza modificare quote o collegamenti.":
      "Modulo già aggiornato."};
  }catch(error){
    console.error("[soci] Conferma singolo modulo non riuscita",error);
    return {ok:false,error:error instanceof Error?error.message:"Conferma non riuscita. Nessun'altra registrazione è stata modificata."};
  }
}

/** Consolida soltanto copie perfettamente identiche, con controllo e archivio SQL atomici. */
export async function consolidateIdenticalGoogleFormsAction(sourceRowId:string):
 Promise<{ok:true;message:string}|{ok:false;error:string}> {
 const operator=await requireAdmin();
 if(!/^(eng:)?[0-9]{1,7}$/.test(sourceRowId))
  return {ok:false,error:"Identificativo modulo non valido."};
 const db=createSupabaseAdminClient();
 // Prima verifica la versione effettiva del Google Sheet corrente.
 // Non scegliere la versione basandosi solo su date o hash già salvati nel DB.
 let preview;
 try{preview=await buildAssociationMembersSyncPreview(db);}
 catch{return {ok:false,error:"Impossibile leggere il modulo Google aggiornato. Riprova dopo la sincronizzazione."};}
 const source=preview.validSourceRows.find(row=>row.source_row_id===sourceRowId);
 if(!source||!/^[a-f0-9]{64}$/.test(source.source_hash))
  return {ok:false,error:"Modulo Google non disponibile o non valido. Nessun dato modificato."};
 const {data,error}=await db.rpc("gw_consolidate_identical_google_form_copies",{
  p_source_row_id:sourceRowId,p_operator_id:operator.id,p_expected_source_hash:source.source_hash
 });
 if(error){
  console.error("[soci] Consolidamento modulo non riuscito",error.code);
  return {ok:false,error:"Non è stato possibile consolidare: verifica che le copie siano identiche e non siano collegate a persone diverse."};
 }
 await clearMembershipCache();refreshGestione();
 return {ok:true,message:`${data} copie archiviate. Il modulo principale e tutti i pagamenti sono stati mantenuti.`};
}
