import "server-only";

import { requireAdmin } from "@/lib/gestionale/server/auth";
import { loadPeople } from "@/lib/gestionale/server/data";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { buildUnifiedDirectory } from "@/lib/gestionale/unified-directory";

export async function loadUnifiedDirectory(today:string){
  await requireAdmin();
  const db=getGestionaleDb();
  const evidence: Array<{
    id:string;first_name:string|null;last_name:string|null;email:string|null;
    source:string|null;membership_status:string|null;membership_starts_at:string|null;
    membership_expires_at:string|null;notes_admin:string|null;
  }>=[];
  for(let offset=0;offset<10000;offset+=500){
    const {data,error}=await db.from("association_members")
      .select("id,first_name,last_name,email,source,membership_status,membership_starts_at,membership_expires_at,notes_admin")
      .in("source",["official_members_book","google_sheet","manual_override"])
      .order("id",{ascending:true}).range(offset,offset+499);
    if(error)throw new Error("Impossibile caricare il registro associativo.");
    evidence.push(...(data??[]));
    if((data??[]).length<500)break;
  }
  return buildUnifiedDirectory({people:await loadPeople(),evidence,today});
}
