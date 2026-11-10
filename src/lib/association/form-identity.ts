const normalizeMail=(s?:string|null)=>{
  const value=(s??"").trim().toLowerCase();
  const [local,domain]=value.split("@");
  if(!local||!domain)return value;
  const d=domain==="googlemail.com"?"gmail.com":domain;
  return d==="gmail.com"?local.split("+")[0].replace(/\./g,"")+"@"+d:local+"@"+d;
};
const key=(first?:string|null,last?:string|null)=>
  [first,last].filter(Boolean).join(" ").trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"").split(/\s+/).filter(Boolean).sort().join(" ");

/** La stessa email non basta a certificare che un modulo intestato a un
 * nome incompatibile appartenga alla persona. Secondi nomi ammessi. */
export function formIdentityCompatible(
  person: {firstName?:string|null;lastName?:string|null;email?:string|null},
  form: {first_name?:string|null;last_name?:string|null;email?:string|null},
): boolean {
  const a=normalizeMail(person.email),b=normalizeMail(form.email);
  if(a&&b&&a!==b)return false;
  const x=key(person.firstName,person.lastName).split(" ").filter(Boolean);
  const y=key(form.first_name,form.last_name).split(" ").filter(Boolean);
  if(x.length>=2&&y.length>=2){
    if(!a&&!b)return x.join(" ")===y.join(" ");
    const xs=new Set(x),ys=new Set(y);
    return x.every(t=>ys.has(t))||y.every(t=>xs.has(t));
  }
  if(x.length&&y.length)return x.join(" ")===y.join(" ");
  return Boolean(a&&b&&a===b);
}
