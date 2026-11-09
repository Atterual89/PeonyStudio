import { createHash } from "node:crypto";
import type { BillingSheet } from "@/lib/gestionale/billing-file";

const normalize=(value:string)=>(value||"").trim().toLocaleLowerCase("it")
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ");
const compact=(value:string)=>normalize(value).replace(/[^a-z0-9]/g,"");

export function suggestAleColumns(headers:string[]){
  const names=headers.map(compact);
  const pick=(accepted:string[])=>{
    const idx=names.findIndex(h=>accepted.includes(h));
    return idx<0?"":String(idx);
  };
  return {
    name:pick(["denominazione","ragionesociale","nominativo","nomecompleto",
      "cliente","nomeecognome","fullname","name"]),
    email:pick(["indirizzoemail","email","emailcliente","mail","emailfatturazione"]),
  };
}

export type AleStagedRow={
  source_key:string;display_name:string;email:string;fields:Record<string,string>;
};

/** Denominazione puo' includere nomi multipli, societa' e nomi stranieri:
 * NON dividere automaticamente in nome/cognome.
 */
export function mappedAleRows(sheet:BillingSheet,mapping:{name:number;email:number|null}):AleStagedRow[]{
  if(!Number.isInteger(mapping.name)||mapping.name<0||mapping.name>=sheet.headers.length||
    (mapping.email!==null&&(!Number.isInteger(mapping.email)||mapping.email<0||
      mapping.email>=sheet.headers.length||mapping.email===mapping.name)))
    throw new Error("Seleziona la colonna Denominazione e, se disponibile, Email.");

  const duplicates=new Map<string,number>();
  return sheet.rows.map(row=>{
    const display_name=(row[mapping.name]||"").trim();
    const email=mapping.email===null?"":(row[mapping.email]||"").trim().toLowerCase();
    const fields=Object.fromEntries(sheet.headers.flatMap((header,i)=>{
      const value=(row[i]||"").trim();
      return value?[[header,value]]:[];
    }));
    if(email)fields.__billing_email=email;
    // Il codice interno, quando disponibile, è l'identificatore del software
    // fiscale. Altrimenti nome, email e identificativo fiscale distinguono
    // le persone; i duplicati perfetti restano in righe distinte.
    const namedKey=(name:string)=>Object.entries(fields).find(([k])=>compact(k)===name)?.[1]||"";
    const external=namedKey("codiceinterno");
    const tax=namedKey("codicefiscale")||namedKey("pivataxid");
    const signature=external?"external:"+normalize(external):
      tax.length>=8?["tax",normalize(display_name),normalize(tax)].join("|"):
      ["person",normalize(display_name),normalize(email)].join("|");
    const nth=(duplicates.get(signature)||0)+1;
    duplicates.set(signature,nth);
    const source_key=createHash("sha256").update(signature+"#"+nth).digest("hex");
    return {source_key,display_name,email,fields};
  }).filter(row=>row.display_name.trim().length>=2);
}
