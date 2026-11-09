"use server";

import { requireOrganizer } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { refreshGestione } from "@/lib/gestionale/server/refresh";
import { readBillingFile } from "@/lib/gestionale/billing-file";
import { mappedAleRows,suggestAleColumns } from "@/lib/gestionale/ale-billing-mapping";
import { isUuidLike } from "@/lib/gestionale/validation";

export type AleContact={
  id:string;displayName:string;email:string;fields:Record<string,string>;
  matched:boolean;updatedAt:string|null;
};
type Result<T>={ok:true;data:T}|{ok:false;error:string};
const fail=(error:unknown)=>({ok:false as const,error:error instanceof Error?error.message:"Operazione non riuscita."});

function uploaded(form:FormData):File{
  const file=form.get("file");
  if(!(file instanceof File))throw new Error("Scegli un file Excel o CSV.");
  return file;
}
export async function previewAleFileAction(form:FormData){
  await requireOrganizer();
  try{
    const sheet=await readBillingFile(uploaded(form));
    return {ok:true as const,data:{
      headers:sheet.headers,sample:sheet.rows.slice(0,3),total:sheet.rows.length,
      suggest:suggestAleColumns(sheet.headers),
    }};
  }catch(error){return fail(error);}
}

export async function importAleFileAction(form:FormData){
  const operator=await requireOrganizer();
  try{
    const sheet=await readBillingFile(uploaded(form));
    const name=Number(form.get("name"));
    const emailRaw=String(form.get("email")??"");
    const email=emailRaw===""?null:Number(emailRaw);
    if(!Number.isInteger(name)||email!==null&&!Number.isInteger(email))
      throw new Error("Seleziona la colonna Denominazione.");
    const rows=mappedAleRows(sheet,{name,email});
    if(rows.length===0)throw new Error("Non ci sono nominativi validi.");
    const {data,error}=await getGestionaleDb().rpc("gw_import_ale_contacts",{
      p_operator_id:operator.id,p_rows:rows,
    });
    if(error)throw new Error("Importazione non riuscita: verifica le colonne o l'allineamento del database.");
    refreshGestione();
    return {ok:true as const,data:data as {created:number;updated:number;skipped:number}};
  }catch(error){return fail(error);}
}

export async function listAleContactsAction():Promise<Result<AleContact[]>>{
  const operator=await requireOrganizer();
  try{
    const {data,error}=await getGestionaleDb().from("gw_ale_contacts")
      .select("id,display_name,email,fields,person_id,updated_at")
      .eq("owner_operator_id",operator.id).order("display_name").range(0,1999);
    if(error)throw new Error("Anagrafica di Alessandra non disponibile.");
    return {ok:true,data:(data??[]).map(r=>({
      id:r.id,displayName:r.display_name,email:r.email??"",
      fields:r.fields as Record<string,string>,matched:Boolean(r.person_id),updatedAt:r.updated_at,
    }))};
  }catch(error){return fail(error);}
}

export async function updateAleContactAction(input:{
  id:string;displayName:string;email:string;fields:Record<string,string>;
}):Promise<Result<null>>{
  const operator=await requireOrganizer();
  if(!isUuidLike(input?.id)||typeof input.displayName!=="string"||
    input.displayName.trim().length<2||input.displayName.length>300||
    typeof input.email!=="string"||input.email.length>320||
    (input.email.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))||
    !input.fields||typeof input.fields!=="object"||Array.isArray(input.fields))
    return {ok:false,error:"Controlla nome, email e dati di fatturazione."};
  const fields:Record<string,string>={};
  for(const [key,value] of Object.entries(input.fields)){
    if(key.length>100||typeof value!=="string"||value.length>500)
      return {ok:false,error:"Uno dei campi è troppo lungo."};
    if(value.trim())fields[key]=value.trim();
  }
  // L'indirizzo della scheda fiscale NON viene trasferito automaticamente
  // alla email canonica di gw_people.
  if(input.email.trim())fields.__billing_email=input.email.trim().toLowerCase();
  else delete fields.__billing_email;
  if(Object.hasOwn(fields,"Denominazione"))fields.Denominazione=input.displayName.trim();
  if(Object.hasOwn(fields,"Indirizzo e-mail"))fields["Indirizzo e-mail"]=input.email.trim().toLowerCase();
  try{
    const {error}=await getGestionaleDb().rpc("gw_update_ale_contact",{
      p_operator_id:operator.id,p_contact_id:input.id,
      p_display_name:input.displayName.trim(),p_email:input.email.trim().toLowerCase()||null,
      p_fields:fields,
    });
    if(error)throw new Error("Salvataggio non riuscito. Verifica il contatto.");
    refreshGestione();
    return {ok:true,data:null};
  }catch(error){return fail(error);}
}
