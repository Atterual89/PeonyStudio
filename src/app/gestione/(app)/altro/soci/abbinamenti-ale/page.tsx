export const maxDuration=120;

import Link from "next/link";
import {requireAdmin} from "@/lib/gestionale/server/auth";
import {todayInRome} from "@/lib/gestionale/workshops";
import {loadUnifiedDirectory} from "@/lib/gestionale/server/unified-directory";
import {listAleMatchingAction} from "./actions";
import {AdminAleMatchingPanel,type AleMatchCandidate} from "@/components/gestionale/AdminAleMatchingPanel";
import {Notice} from "@/components/gestionale/ui";

export default async function AleMatchingPage({ searchParams }: { searchParams: Promise<{ contatto?: string | string[] }> }){
  await requireAdmin();
  const { contatto } = await searchParams;
  const [staging,registry]=await Promise.all([
    listAleMatchingAction(),
    loadUnifiedDirectory(todayInRome()).catch((error:unknown)=>{
      console.error("[gestionale] Registro matching Ale non disponibile",error instanceof Error?error.message:"errore");
      return null;
    }),
  ]);
  const candidates:AleMatchCandidate[]=(registry??[]).map(row=>({
    key:row.key,personId:row.personId,name:row.name,nickname:row.nickname,
    email:row.email,search:row.search,source:row.source,association:row.association,
  }));
  return <section className="mx-auto max-w-4xl space-y-4">
    <Link prefetch={false} href="/gestione/altro/soci" className="text-sm underline">← Verifiche</Link>
    <div>
      <h1 className="font-serif text-xl font-medium">Matching Alessandra · anagrafica comune</h1>
      <p className="mt-1 text-sm text-[#5f524c]">Riservato agli admin. Alessandra può modificare i propri contatti, ma non accede a libro soci, moduli o quote.</p>
    </div>
    {!registry?<Notice tone="error">Registro associativo non disponibile: abbinamenti sospesi finché non torna accessibile.</Notice>:null}
    {!staging.ok?<Notice tone="error">{staging.error}</Notice>:null}
    {registry&&staging.ok?<AdminAleMatchingPanel rows={staging.data} candidates={candidates} focusedContactId={typeof contatto==="string"?contatto:undefined}/>:null}
  </section>;
}
