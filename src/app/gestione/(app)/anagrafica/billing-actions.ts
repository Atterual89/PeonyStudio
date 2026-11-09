"use server";

import { requireOrganizer } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { refreshGestione } from "@/lib/gestionale/server/refresh";
import { normalizeText } from "@/lib/gestionale/format";
import { mappedBillingRows, readBillingFile, suggestBillingColumns } from "@/lib/gestionale/billing-file";
import { isUuidLike } from "@/lib/gestionale/validation";

export type BillingEntry = { id: string; name: string; email: string; nickname?:string|null; fields?: Record<string,string> };
export type BillingReview = {
  id: string; name: string; email: string; reason: string;
  candidates: { id: string; name: string }[];
};

function fileOf(form: FormData): File {
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("Seleziona un Excel o CSV.");
  return file;
}
function publicError(error: unknown) {
  return error instanceof Error ? error.message : "Operazione non riuscita.";
}
function operatorRow(row: { gw_people: unknown }) {
  const nested = row.gw_people;
  return (Array.isArray(nested) ? nested[0] : nested) as {
    first_name: string|null; last_name:string|null; nickname?:string|null; deleted_at:string|null; merged_into:string|null
  }|null;
}

export async function previewBillingFileAction(form: FormData) {
  await requireOrganizer();
  try {
    const sheet = await readBillingFile(fileOf(form));
    return { ok:true as const, data:{
      headers:sheet.headers, sample:sheet.rows.slice(0,4),
      total:sheet.rows.length, suggest:suggestBillingColumns(sheet.headers)
    }};
  } catch(error) { return {ok:false as const,error:publicError(error)}; }
}

export async function importBillingFileAction(form: FormData) {
  const operator=await requireOrganizer();
  try {
    const sheet=await readBillingFile(fileOf(form));
    if(form.get("first")===null||form.get("last")===null)throw new Error("Seleziona nome e cognome.");
    const first=Number(form.get("first"));
    const last=Number(form.get("last"));
    const selectedEmail=String(form.get("email")??"");
    const email=selectedEmail===""?null:Number(selectedEmail);
    if(!Number.isInteger(first)||!Number.isInteger(last)||(email!==null&&!Number.isInteger(email)))
      throw new Error("Seleziona nome e cognome.");
    const rows=mappedBillingRows(sheet,{first,last,email});
    const db=getGestionaleDb();
    const {data,error}=await db.rpc("gw_import_billing_rows",{
      p_operator_id:operator.id,p_rows:rows,
    });
    if(error)throw new Error(error.message);
    refreshGestione();
    return {ok:true as const,data:data as {created:number;matched:number;review:number;skipped:number}};
  }catch(error){return{ok:false as const,error:publicError(error)};}
}

async function billingRows(operatorId:string) {
  const db=getGestionaleDb();
  const {data,error}=await db.from("gw_billing_profiles")
    .select("person_id,fields,gw_people!inner(first_name,last_name,nickname,deleted_at,merged_into)")
    .eq("owner_operator_id",operatorId).order("updated_at",{ascending:false}).limit(10000);
  if(error)throw new Error("Non riesco a leggere l'anagrafica importata.");
  return (data??[]).flatMap(row=>{
    const person=operatorRow(row);
    if(!person||person.deleted_at||person.merged_into)return[];
    const name=[person.first_name,person.last_name].filter(Boolean).join(" ").trim();
    const fields=row.fields as Record<string,string>;
    return name?[{id:row.person_id,name,email:String(fields?.__billing_email||""),nickname:person.nickname??null,fields}]:[];
  });
}

export async function searchBillingDirectoryAction(input:{query:string}) {
  const operator=await requireOrganizer();
  const query=normalizeText(String(input?.query||"").slice(0,100));
  if(query.length<2)return {ok:true as const,data:[] as BillingEntry[]};
  try {
    const tokens=query.split(/\s+/).filter(Boolean);
    const operatorId=operator.id;
    const people=await billingRows(operatorId);
    // Cerca solo tra persone già presenti nell'anagrafica fatture di Ale:
    // l'alias non dà accesso a schede esterne ai suoi corsi.
    const ids=[...new Set(people.map(p=>p.id))];
    const aliasesByPerson=new Map<string,string[]>();
    for(let i=0;i<ids.length;i+=500){
      const {data,error}=await getGestionaleDb().from("gw_person_aliases")
        .select("person_id,alias").in("person_id",ids.slice(i,i+500))
        .is("deleted_at",null).range(0,9999);
      if(error)break;
      for(const row of data??[])
        aliasesByPerson.set(row.person_id,[...(aliasesByPerson.get(row.person_id)??[]),row.alias]);
    }
    const results=people.filter(p=>{
      const search=normalizeText([p.name,p.email,p.nickname,...(aliasesByPerson.get(p.id)??[])].filter(Boolean).join(" "));
      return tokens.every(t=>search.includes(t));
    })
      .sort((a,b)=>a.name.localeCompare(b.name,"it")).slice(0,20)
      .map(({id,name,email,nickname})=>({id,name,email,nickname}));
    return {ok:true as const,data:results};
  } catch(error){return {ok:false as const,error:publicError(error)};}
}

export async function listBillingDirectoryAction() {
  const operator=await requireOrganizer();
  try {
    const operatorId=operator.id;
    const people=await billingRows(operatorId);
    const {data,error}=await getGestionaleDb().from("gw_billing_import_reviews")
      .select("id,first_name,last_name,email,reason,candidate_ids")
      .eq("owner_operator_id",operator.id).eq("status","pending")
      .order("created_at",{ascending:false}).limit(200);
    if(error)throw new Error("Impossibile caricare gli abbinamenti da rivedere.");
    const reviews= data??[];
    const ids=[...new Set(reviews.flatMap(r=>r.candidate_ids as string[]))].filter(isUuidLike);
    const {data:candidates,error:personError}=ids.length?
      await getGestionaleDb().from("gw_people").select("id,first_name,last_name")
        .in("id",ids.slice(0,500)).is("deleted_at",null).is("merged_into",null):
      {data:[],error:null};
    if(personError)throw new Error("Impossibile leggere le persone possibili.");
    const byId=new Map((candidates??[]).map(p=>[p.id,[p.first_name,p.last_name].filter(Boolean).join(" ")]));
    return {ok:true as const,data:{
      people:people.sort((a,b)=>a.name.localeCompare(b.name,"it")),
      reviews:reviews.map(r=>({
        id:r.id,name:[r.first_name,r.last_name].filter(Boolean).join(" "),
        email:r.email||"",reason:r.reason,
        candidates:(r.candidate_ids as string[]).filter(id=>byId.has(id))
          .map(id=>({id,name:byId.get(id)!}))
      })) as BillingReview[]
    }};
  }catch(error){return{ok:false as const,error:publicError(error)};}
}

export async function resolveBillingReviewAction(input:{reviewId:string;personId:string|null}) {
  const operator=await requireOrganizer();
  if(!isUuidLike(input?.reviewId)||input.personId!==null&&!isUuidLike(input.personId))
    return {ok:false as const,error:"Selezione non valida."};
  const {error}=await getGestionaleDb().rpc("gw_resolve_billing_review",{
    p_operator_id:operator.id,p_review_id:input.reviewId,p_person_id:input.personId,
  });
  if(error)return {ok:false as const,error:"Impossibile abbinare. Verifica il nominativo."};
  refreshGestione();
  return {ok:true as const};
}
