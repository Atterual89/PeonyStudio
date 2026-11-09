"use server";

import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { getPerson, loadPeople } from "@/lib/gestionale/server/data";
import { loadAliases } from "@/lib/gestionale/server/aliases";
import { getMemberSummary } from "@/lib/gestionale/server/membership";
import { createPersonWithAliases } from "@/lib/gestionale/server/mutations";
import { refreshGestione } from "@/lib/gestionale/server/refresh";
import { memberKeyOfPerson, parseMemberKey } from "@/lib/gestionale/member-key";
import { normalizeMembershipEmail, normalizeMembershipNameKey } from "@/lib/association/membership-state";
import { matchesPersonQuery } from "@/lib/gestionale/people";
import { normalizeText } from "@/lib/gestionale/format";
import { isUuidLike } from "@/lib/gestionale/validation";
import { linkMemberAction } from "@/app/gestione/(app)/w/actions";

export type DirectoryProfileChoice = {
  id: string;
  version: number;
  name: string;
  nickname: string | null;
  email: string | null;
  hasMemberLink: boolean;
};

type Result<T> = {ok:true;data:T}|{ok:false;error:string};

export async function searchDirectoryProfilesAction(query:string):Promise<Result<DirectoryProfileChoice[]>> {
  await requireAdmin();
  const value=typeof query==="string"?query.trim():"";
  if(value.length<2||value.length>120) return {ok:false,error:"Scrivi almeno due caratteri."};
  const [people,aliases]=await Promise.all([loadPeople(),loadAliases()]);
  const aliasMap=new Map<string,string[]>();
  for(const alias of aliases)aliasMap.set(alias.personId,[...(aliasMap.get(alias.personId)??[]),alias.alias]);
  const words=normalizeText(value).split(/\s+/).filter(Boolean);
  const results=people.filter(person=>!person.merged_into&&(
    matchesPersonQuery(person,value) ||
    words.every(word=>normalizeText((aliasMap.get(person.id)??[]).join(" ")).includes(word))
  )).slice(0,20);
  return {ok:true,data:results.map(person=>({
    id:person.id,version:person.version,
    name:[person.first_name,person.last_name].filter(Boolean).join(" ").trim()||person.nickname||person.email||"Persona",
    nickname:person.nickname,email:person.email,
    hasMemberLink:Boolean(memberKeyOfPerson(person)),
  }))};
}

/** Una fonte associativa senza scheda puo' generare una scheda solo con
 * conferma esplicita e controllo server anti-duplicati. Nessun pagamento
 * viene creato. Se il collegamento fallisce, la scheda rimane accessibile.
 */
export async function createRegistryPersonAction(memberKey:string):Promise<Result<{id:string;linked:boolean;warning:string|null}>> {
  const operator=await requireAdmin();
  if(!parseMemberKey(memberKey))return {ok:false,error:"Registrazione non valida. Ricarica."};
  const member=await getMemberSummary(memberKey);
  if(!member)return {ok:false,error:"Registrazione non trovata. Aggiorna la pagina."};
  const first=(member.first_name??"").trim();
  const last=(member.last_name??"").trim();
  if(!first||!last)return {ok:false,error:"Nome e cognome incompleti: cerca un'anagrafica oppure creala manualmente."};
  const email=normalizeMembershipEmail(member.email);
  const name=normalizeMembershipNameKey(first,last);
  const people=await loadPeople();
  const matches=people.filter(p=>!p.merged_into&&(
    (email&&normalizeMembershipEmail(p.email)===email) ||
    (name&&normalizeMembershipNameKey(p.first_name,p.last_name)===name) ||
    memberKeyOfPerson(p)===memberKey
  ));
  if(matches.length)return {ok:false,error:"Esiste già una possibile anagrafica. Usa «Cerca e collega» per evitare duplicati."};
  const created=await createPersonWithAliases(operator.id,{
    first_name:first,last_name:last,email:email||null,
    nickname:null,instagram:null,phone:null,teamartist_id:null,notes:null,
  },[]);
  if(!created.ok)return {ok:false,error:created.error};
  const {data:row,error}=await getGestionaleDb().from("gw_people")
    .select("id,version").eq("id",created.data).maybeSingle();
  if(error||!row)return {ok:true,data:{id:created.data,linked:false,warning:"Scheda creata: aprila per completare il collegamento."}};
  const linked=await linkMemberAction({personId:row.id,version:row.version,memberId:memberKey});
  if(!linked.ok)return {ok:true,data:{id:row.id,linked:false,warning:"Scheda creata, ma il collegamento non è riuscito. Apri la scheda e verifica l'abbinamento."}};
  refreshGestione();
  return {ok:true,data:{id:row.id,linked:true,warning:null}};
}

export async function linkRegistryProfileAction(input:{
  memberKey:string;personId:string;version:number;
}):Promise<Result<null>> {
  await requireAdmin();
  if(!parseMemberKey(input?.memberKey)||!isUuidLike(input?.personId)||!Number.isInteger(input.version))
    return {ok:false,error:"Selezione non valida."};
  const person=await getPerson(input.personId);
  if(!person||person.merged_into||person.version!==input.version)
    return {ok:false,error:"La scheda è cambiata: aggiorna e riprova."};
  const already=memberKeyOfPerson(person);
  if(already&&already!==input.memberKey)
    return {ok:false,error:"Questa anagrafica ha già un collegamento associativo: aprila e controllalo prima di sostituirlo."};
  const result=await linkMemberAction({
    personId:person.id,version:person.version,memberId:input.memberKey,
  });
  if(!result.ok)return {ok:false,error:result.error};
  return {ok:true,data:null};
}
