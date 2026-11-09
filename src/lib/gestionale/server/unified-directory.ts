import "server-only";

import { requireAdmin } from "@/lib/gestionale/server/auth";
import { loadPeople } from "@/lib/gestionale/server/data";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { buildUnifiedDirectory } from "@/lib/gestionale/unified-directory";

/** All names associated with an existing profile, including old values from
 * Ale's bookings. These values are search hints only, never proof of identity.
 * A failed alias lookup must never make the person directory unavailable.
 */
async function loadSearchAliases():Promise<Map<string,string[]>> {
  const db=getGestionaleDb();
  async function read(table:"gw_person_aliases"|"gw_booking_participants",field:"alias"|"entered_as"){
    const rows:Array<{person_id:string;name:string}>=[];
    for(let offset=0;offset<10000;offset+=500){
      const {data,error}=await db.from(table).select(`person_id,${field}`)
        .is("deleted_at",null).order("id",{ascending:true}).range(offset,offset+499);
      if(error)throw new Error(`Ricerca nomi storici: ${table}`);
      for(const item of data??[]){
        const record=item as unknown as Record<string,unknown>;
        const name=record[field];
        if(typeof record.person_id==="string"&&typeof name==="string"&&name.trim())
          rows.push({person_id:record.person_id,name:name.trim()});
      }
      if((data??[]).length<500)break;
    }
    return rows;
  }
  const [aliases,bookings]=await Promise.all([
    read("gw_person_aliases","alias"),read("gw_booking_participants","entered_as"),
  ]);
  const seen=new Map<string,Set<string>>();
  for(const item of [...aliases,...bookings]){
    const set=seen.get(item.person_id)??new Set<string>();
    set.add(item.name);
    seen.set(item.person_id,set);
  }
  return new Map([...seen].map(([id,names])=>[id,[...names]]));
}

export async function loadUnifiedDirectory(today:string){
  await requireAdmin();
  const db=getGestionaleDb();
  const [people,aliasMap]=await Promise.all([
    loadPeople(),
    loadSearchAliases().catch((error:unknown)=>{
      console.warn("[gestionale] Ricerca nomi storici non disponibile",error instanceof Error?error.message:error);
      return new Map<string,string[]>();
    }),
  ]);
  const evidence: Array<{
    id:string;first_name:string|null;last_name:string|null;email:string|null;
    source:string|null;membership_status:string|null;membership_starts_at:string|null;
    membership_expires_at:string|null;notes_admin:string|null;
  }>=[];
  for(let offset=0;offset<10000;offset+=500){
    const {data,error}=await db.from("association_members")
      .select("id,first_name,last_name,email,source,membership_status,membership_starts_at,membership_expires_at,notes_admin")
      .in("source",["google_sheet","manual_override","official_members_book"])
      .order("id",{ascending:true}).range(offset,offset+499);
    if(error)throw new Error("Impossibile caricare il registro associativo.");
    evidence.push(...(data??[]));
    if((data??[]).length<500)break;
  }
  return buildUnifiedDirectory({people,evidence,today,aliasesByPerson:aliasMap});
}
