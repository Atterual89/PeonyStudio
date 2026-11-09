import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/gestionale/server/auth";

// Punto di ricerca unico: i vecchi link a /cerca rimangono validi, ma non
// aprono una seconda schermata con risultati e azioni differenti.
export default async function CercaPage({
 searchParams,
}:{
 searchParams?:Promise<{q?:string|string[]}>,
}={}){
 await requireAdmin();
 const params=searchParams?await searchParams:{};
 const query=typeof params.q==="string"?params.q.trim().slice(0,100):"";
 redirect(query?`/gestione/persone?q=${encodeURIComponent(query)}`:"/gestione/persone");
}
