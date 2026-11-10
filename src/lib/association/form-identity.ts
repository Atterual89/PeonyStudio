const normalizeMembershipEmail=(s?:string|null)=>{
  const value=(s??"").trim().toLowerCase();
  const [local,domain]=value.split("@");
  if(!local||!domain)return value;
  const d=domain==="googlemail.com"?"gmail.com":domain;
  return d==="gmail.com"?`${local.split("+")[0].replace(/\\./g,"")}@${d}`:`${local}@${d}`;
};
const normalizeMembershipNameKey=(first?:string|null,last?:string|null)=>
  [first,last].filter(Boolean).join(" ").trim().toLowerCase().normalize("NFD")
  .replace(/[\\u0300-\\u036f]/g,"").split(/\\s+/).filter(Boolean).sort().join(" ");

/** Correlazione prudente: il solo indirizzo email può essere condiviso.
 * Il cognome deve coincidere e i nomi possono differire solo per secondi nomi.
 * Un nome completamente diverso resta da verificare manualmente. */
export function formIdentityCompatible(
  person: {firstName?:string|null;lastName?:string|null;email?:string|null},
  form: {first_name?:string|null;last_name?:string|null;email?:string|null},
): boolean {
  const personMail=normalizeMembershipEmail(person.email);
  const formMail=normalizeMembershipEmail(form.email);
  if(personMail&&formMail&&personMail!==formMail)return false;
  const personTokens=normalizeMembershipNameKey(person.firstName,person.lastName).split(" ").filter(Boolean);
  const formTokens=normalizeMembershipNameKey(form.first_name,form.last_name).split(" ").filter(Boolean);
  if(personTokens.length>=2&&formTokens.length>=2){
    const left=new Set(personTokens),right=new Set(formTokens);
    const compatible=personTokens.every(token=>right.has(token)) ||
      formTokens.every(token=>left.has(token));
    return compatible && (!personMail||!formMail||personMail===formMail);
  }
  // Per nomi assenti non si deduce un'identità dal solo email se il modulo
  // riporta un nome sostanziale diverso.
  if(personTokens.length>0&&formTokens.length>0)return personTokens.join(" ")===formTokens.join(" ");
  return Boolean(personMail&&formMail&&personMail===formMail);
}
