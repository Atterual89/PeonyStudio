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
        .select("id,source,source_row_id,first_name,last_name,email,membership_status")
        .in("source",["google_sheet","manual_override"]).order("id").range(0,9999),
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
