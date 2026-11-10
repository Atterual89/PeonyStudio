import {normalizeMembershipEmail} from "@/lib/association/membership-state";

export type AutoPaymentCandidate={
  kind:"person"|"member";id:string;name:string;email:string|null;source:string;
};
const tokens=(value:string|null|undefined):string[] =>
 (value??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
   .replace(/[^a-z0-9]+/g," ").trim().split(/\s+/).filter(Boolean);
const key=(value:string|null|undefined)=>tokens(value).sort().join(" ");
export function paymentNameMatch(payer:string|null|undefined,candidate:string|null|undefined):number{
  const a=tokens(payer),b=tokens(candidate);
  if(a.length<2||b.length<2)return 0;
  const aa=new Set(a),bb=new Set(b);
  if(aa.size===bb.size && [...aa].every(t=>bb.has(t)))return 100;
  // Nomi con secondo cognome (Raquel Paredes Camí / Camí Raquel).
  if(bb.size>=2&&[...bb].every(t=>aa.has(t)))return 80;
  if(aa.size>=2&&[...aa].every(t=>bb.has(t)))return 75;
  return 0;
}
export function proposePeopleForPayment(payer:string|null|undefined,
  people:readonly AutoPaymentCandidate[],forms:readonly AutoPaymentCandidate[]):AutoPaymentCandidate[]{
  const ranked=[...people,...forms].map(p=>({p,score:paymentNameMatch(payer,p.name)}))
    .filter(x=>x.score>=75).sort((a,b)=>b.score-a.score||Number(a.p.kind!=="person")-Number(b.p.kind!=="person"));
  const seen=new Set<string>(),out:AutoPaymentCandidate[]=[];
  for(const {p} of ranked){
    const e=normalizeMembershipEmail(p.email);
    const k=e&&e.includes("@")?"e:"+e:"n:"+key(p.name);
    if(seen.has(k))continue;
    seen.add(k);
    out.push(p);
  }
  return out.slice(0,4);
}
