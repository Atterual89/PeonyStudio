import "server-only";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { loadUnifiedDirectory } from "@/lib/gestionale/server/unified-directory";
import { loadPeople } from "@/lib/gestionale/server/data";
import { formIdentityCompatible } from "@/lib/association/form-identity";
import { normalizeMembershipEmail,normalizeMembershipNameKey } from "@/lib/association/membership-state";

type MemberRow={
  id:string;source:string;source_row_id:string|null;
  first_name:string|null;last_name:string|null;email:string|null;
};
export type AuditDuplicate={
  key:string;reason:"modulo duplicato"|"anagrafica doppia"|"email con nomi discordanti";
  name:string;email:string|null;recordCount:number;personIds:string[];
};
async function loadMembers(){
  const rows:MemberRow[]=[];
  for(let offset=0;offset<10000;offset+=500){
    const {data,error}=await getGestionaleDb().from("association_members")
      .select("id,source,source_row_id,first_name,last_name,email")
      .in("source",["google_sheet","manual_form","manual_override"])
      .order("id").range(offset,offset+499);
    if(error)throw new Error("Lettura delle registrazioni associativa non disponibile.");
    rows.push(...(data??[]));
    if((data??[]).length<500)break;
  }
  return rows;
}
const display=(row:{first_name:string|null;last_name:string|null})=>
  [row.first_name,row.last_name].filter(Boolean).join(" ").trim()||"Nominativo non disponibile";

export async function loadIdentityAudit(today:string){
  await requireAdmin();
  const [contacts,people,rows]=await Promise.all([
    loadUnifiedDirectory(today),loadPeople(),loadMembers(),
  ]);
  const duplicates:AuditDuplicate[]=[];
  const googleRows=rows.filter(row=>row.source==="google_sheet");
  const bySource=new Map<string,MemberRow[]>();
  for(const row of googleRows)if(row.source_row_id)
    bySource.set(row.source_row_id,[...(bySource.get(row.source_row_id)??[]),row]);
  for(const [key,matches] of bySource)if(matches.length>1){
    duplicates.push({key:"google:"+key,reason:"modulo duplicato",
      name:display(matches[0]),email:matches[0].email,
      recordCount:matches.length,personIds:[]});
  }
  const active=people.filter(p=>!p.merged_into);
  const seen=new Set<string>();
  for(let i=0;i<active.length;i++){
    const a=active[i],duplicatesOfA=[a];
    for(let j=i+1;j<active.length;j++){
      const b=active[j],e1=normalizeMembershipEmail(a.email),e2=normalizeMembershipEmail(b.email);
      const n1=normalizeMembershipNameKey(a.first_name,a.last_name);
      const n2=normalizeMembershipNameKey(b.first_name,b.last_name);
      if((e1&&e1===e2)||(n1&&n1===n2))duplicatesOfA.push(b);
    }
    const ids=duplicatesOfA.map(p=>p.id).sort();
    if(ids.length>1&&!seen.has(ids.join("|"))){
      seen.add(ids.join("|"));
      duplicates.push({key:"person:"+ids.join(":"),reason:"anagrafica doppia",
        name:display(a),email:a.email,recordCount:ids.length,personIds:ids});
    }
  }
  // Condividere un'email non significa essere la stessa persona.
  for(const person of active){
    const mail=normalizeMembershipEmail(person.email);
    if(!mail)continue;
    const conflicting=rows.filter(row=>row.source==="google_sheet"&&
      normalizeMembershipEmail(row.email)===mail&&!formIdentityCompatible(
        {firstName:person.first_name,lastName:person.last_name,email:person.email},row));
    if(!conflicting.length)continue;
    duplicates.push({key:"email:"+person.id,reason:"email con nomi discordanti",
      name:display(person)+" / "+display(conflicting[0]),email:person.email,
      recordCount:1+conflicting.length,personIds:[person.id]});
  }
  const counts={people:contacts.filter(c=>c.personId).length,
    formsToVerify:contacts.filter(c=>c.personId&&!c.formPresent).length,
    paymentsToVerify:contacts.filter(c=>c.personId&&!c.quotaPaid).length,
    verified:contacts.filter(c=>c.personId&&c.formPresent&&c.quotaPaid).length,
    duplicates:duplicates.length};
  return {contacts:contacts.filter(c=>Boolean(c.personId)),duplicates,counts};
}
