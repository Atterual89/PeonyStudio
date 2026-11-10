import { paymentNameMatch, proposePeopleForPayment, type AutoPaymentCandidate } from "@/lib/gestionale/payment-auto-proposals";

export type PaymentNoteKind="membership"|"other"|"uncertain";

const memberPattern=/(?:\bquot[ae]\s*(?:associativ\w*|ass\.?|soci\w*|tessera|iscrizion\w*)\b|\bquota\s+socio\b|\bquota\s+ass\.?\b|\bmembership\s*(?:fee|dues?|payment|for)\b|\bannual\s*(?:fee|membership)\b|\bregistration\s+fee\b|\btessera\s+(?:associativa|di iscrizione)\b|\brinnovo\s+tessera\b|\badh[eé]sion\b|\bversamento\s+quota\b)/i;
const eventPattern=/\b(?:pratica(?:\s+guidata)?|focus\s+gote|rope[\s-]?jam|workshop|classe?|course|corso|level\s*up|studio\s+fee|ingresso|open\s+day|peony\s+card|rope\s+night)\b/i;

export function classifyPaymentNote(note:string|null|undefined):PaymentNoteKind {
  if(!note?.trim())return "uncertain";
  if(memberPattern.test(note))return "membership";
  if(eventPattern.test(note))return "other";
  return "uncertain";
}
const prefix=/^\s*(?:(?:pagamento|versamento|rinnovo)\s+)?(?:(?:quote?|quota)\s*(?:associativ\w*|ass\.?|soci\w*|socio|tessera|iscrizion\w*)?|(?:membership|annual|registration)\s*(?:fee|dues?|payment)|tessera\s+(?:associativa|di iscrizione)|rinnovo\s+tessera)\s*(?:per|for|di|payment)?\s*[:;,.-]?\s*/i;
export function paymentBeneficiaryHints(note:string|null|undefined):string[]{
  if(classifyPaymentNote(note)!=="membership"||!note)return [];
  let content=note.trim();
  // E.g. "Marie Rauers - membership fee".
  const leading=content.match(/^(.{3,80}?)\s*[-–]\s*(?:membership|annual)\s+fee\b/i);
  if(leading)content=leading[1];
  else if(prefix.test(content))content=content.replace(prefix,"").trim();
  else return [];
  content=content.replace(/^(?:for|per|di)\s+/i,"").trim();
  if(!content||/^(?:fee|quote?|soci|associativ|tessera|membership)\b/i.test(content))return [];
  // No assumption that one token identifies a unique person.
  const parts=content.split(/\s*(?:\+|&|\/|,|\s+e\s+|\s+and\s+)\s*/i);
  return [...new Set(parts.map(part=>part.replace(/\s*\([^)]*\)\s*$/,"").trim())
    .filter(part=>part.length>=2 && part.length<=85)
    .filter(part=>!/\b(?:workshop|corso|pratica|level|202[5-9]|gote|studio)\b/i.test(part)))].slice(0,4);
}

export function proposalsFromPayment(
  payer:string|null|undefined,note:string|null|undefined,
  people:readonly AutoPaymentCandidate[],forms:readonly AutoPaymentCandidate[]
):{proposals:AutoPaymentCandidate[];beneficiaryHints:string[];kind:PaymentNoteKind} {
  const kind=classifyPaymentNote(note);
  const beneficiaryHints=paymentBeneficiaryHints(note);
  if(kind==="other")return {proposals:[],beneficiaryHints:[],kind};
  const queries=beneficiaryHints.length?beneficiaryHints:[payer??""];
  const choices=queries.flatMap(hint=>proposePeopleForPayment(hint,people,forms));
  const seen=new Set<string>();
  return {kind,beneficiaryHints,proposals:choices.filter(person=>{
    const key=person.email?.toLowerCase()||person.kind+person.id;
    if(seen.has(key))return false;
    seen.add(key);return true;
  }).slice(0,6)};
}

/** Review signal, not a proof: never silently move or remove allocations. */
export function suspiciousAllocation(note:string|null|undefined,allocatedName:string):string|null{
  const kind=classifyPaymentNote(note);
  if(kind==="other")return "La causale sembra riferirsi a un evento, non a una quota.";
  const hints=paymentBeneficiaryHints(note);
  if(hints.length && !hints.some(hint=>paymentNameMatch(hint,allocatedName)>=75
      || (hint.split(/\s+/).length===1 &&
        allocatedName.toLowerCase().split(/\s+/).includes(hint.toLowerCase())))){
    return "Il beneficiario indicato nella causale non coincide con la persona assegnata.";
  }
  return null;
}
