import {
  emailAssets, emailBox, emailButton, emailParagraph, emailSection, escapeHtml,
} from "@/lib/gestionale/email/layout";
import { membershipPeriodForPayment } from "@/lib/association/membership-periods";
import {
  isRopeJamEvent, isWorkshopEvent, peonyAssociationFormUrl,
  type PeonyEmailAudience, type PeonyEmailEventContext, type PeonyEmailLanguage,
} from "@/lib/gestionale/peony-email-context";

export type PeonyEmailDetailFields = {
  doorsOpen?: string;
  dailyStart?: string;
  dailyEnd?: string;
  lunchBreak?: string;
  lastEntry?: string;
  arrivalNote?: string;
  program?: string;
  ropes?: string;
  clothing?: string;
  prerequisites?: string;
  riggersPrerequisites?: string;
  modelsPrerequisites?: string;
  partnerPolicy?: string;
  optionalActivityTitle?: string;
  optionalActivityInfo?: string;
  optionalActivityUrl?: string;
  extraNotes?: string;
  includeTicketTailorDescription?: boolean;
};

export const PEONY_DETAIL_FIELDS: { key: Exclude<keyof PeonyEmailDetailFields,"includeTicketTailorDescription">; label: string; multiline?: boolean }[] = [
  {key:"doorsOpen",label:"Apertura porte / Doors open"},
  {key:"dailyStart",label:"Inizio giornaliero / Daily start"},
  {key:"dailyEnd",label:"Fine giornaliera / Daily end"},
  {key:"lunchBreak",label:"Pausa pranzo / Lunch break"},
  {key:"lastEntry",label:"Ultimo ingresso (Rope Jam)"},
  {key:"arrivalNote",label:"Indicazioni su quando arrivare",multiline:true},
  {key:"program",label:"Programma del workshop",multiline:true},
  {key:"ropes",label:"Corde da portare",multiline:true},
  {key:"clothing",label:"Abbigliamento",multiline:true},
  {key:"prerequisites",label:"Prerequisiti generali",multiline:true},
  {key:"riggersPrerequisites",label:"Prerequisiti rigger",multiline:true},
  {key:"modelsPrerequisites",label:"Prerequisiti model",multiline:true},
  {key:"partnerPolicy",label:"Regole per i partner",multiline:true},
  {key:"optionalActivityTitle",label:"Attività collegata (es. Friday Rope Jam)"},
  {key:"optionalActivityInfo",label:"Descrizione attività collegata",multiline:true},
  {key:"optionalActivityUrl",label:"Link iscrizione attività collegata"},
  {key:"extraNotes",label:"Altre informazioni utili",multiline:true},
];

const mapsUrl="https://maps.app.goo.gl/CnoZpoZmgzP3Absg9";
const lunchMapUrl="https://www.google.com/maps/d/u/1/edit?mid=1-0Kk4XI6J6-GaER13vBTEmm2Bse3-uM&usp=sharing";
const vademecum="https://peonystudio.net/vademecum-rope-jam";

/** Safe paragraphs from TT or the admin editor; never interpolate HTML markup. */
function paragraphs(value: string | null | undefined): string {
  const str=value?.trim();
  if(!str)return "";
  return str.split(/\n\s*\n/).filter(Boolean).map(part =>
    '<p style="margin:0 0 16px;">'+escapeHtml(part).replace(/\r?\n/g,"<br>")+"</p>").join("");
}
function list(items: string[]): string {
  if (!items.length) return "";
  return '<ul style="margin:0;padding-left:22px;font-size:16px;line-height:1.75;">' +
    items.map(item=>'<li style="margin-bottom:9px;">'+escapeHtml(item)+"</li>").join("")+"</ul>";
}
function line(label:string, value?:string | null):string {
  return value?.trim()? '<p style="margin:0 0 10px;"><strong>'+escapeHtml(label)+
    '</strong> '+escapeHtml(value.trim())+"</p>" : "";
}
function dateRange(input:{dateLabel:string;context?:PeonyEmailEventContext}):string {
  return input.dateLabel && input.dateLabel!=="Data da definire" ? input.dateLabel : "";
}
function periodUntil(context?:PeonyEmailEventContext):string|null {
  const period=context?.startsOn ? membershipPeriodForPayment(new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" })) : null;
  if (!period)return null;
  const [year,month,day]=period.validUntil.split("-");
  return day+"/"+month+"/"+year;
}
function safeUrl(url?:string|null):string|null{
  return url && /^https:\/\//i.test(url) ? url : null;
}
function place(en:boolean):string{
  return emailSection(en?"Location":"Peony Studio",
    '<p style="margin:0 0 12px;"><strong>Peony Studio</strong><br>'+
    'Via Vandalino 85/38, Torino<br>'+
    (en?"Intercom: <strong>UR Expression</strong> · Floor -1":
      "Citofono: <strong>UR Expression</strong> · Piano -1")+"</p>"+
    emailButton(en?"Find us on Google Maps":"Ci trovi su Google Maps",mapsUrl)+
    '<img src="'+emailAssets.entrance+'" alt="Ingresso Peony Studio" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:12px;margin:20px auto 0;">');
}
function access(en:boolean, workshop:boolean):string[]{
  const directions=en?[
    "By Metro: take the Turin Metro to Marche station, Via Eritrea exit. Peony Studio is about 5 minutes on foot.",
    "By Car: street parking is available near the venue.",
  ]:[
    "In metro: scendi alla fermata Marche e usa l'uscita Via Eritrea; siamo a circa 5 minuti a piedi.",
    "In auto: parcheggio su strada disponibile nei dintorni.",
  ];
  const rules=en?[
    "Please do not wait in a large group in front of the building entrance.",
    'The intercom is labelled "UR Expression". Ring twice, then go to floor -1 (ground floor is 0).',
    "You will find a door with a Peony on it.",
    "Please keep quiet on the stairs: the building is residential.",
  ]:[
    "Ti chiediamo di non sostare in gruppo davanti all'ingresso del palazzo.",
    'Il citofono è "UR Expression". Suona due volte e scendi al piano -1 (il piano terra è 0).',
    "Troverai una porta con una peonia.",
    "Mantieni il silenzio sulle scale: il palazzo è abitato.",
  ];
  return workshop?[
    emailSection(en?"How to Access the Venue":"Come raggiungere lo studio",list(directions)),
    emailBox(en?"Important Notes for Your Arrival at Peony Studio":"Indicazioni importanti per l'ingresso",list(rules)),
  ]:[emailBox(en?"How to access the venue":"Come accedere allo studio",list([...directions,...rules]))];
}
function venueRules(en:boolean, jam:boolean):string {
  const rules=en?[
    "The studio is a shoes-free space. Remove your shoes at the entrance.",
    "You may leave your bags in the designated area. Keep valuables with you.",
    "Smoking and vaping are not allowed inside.",
    "No open drinks in the rope area; only bottles or closed containers.",
    "Drinking water is available in the kitchen.",
  ]:[
    "Lo studio è uno spazio senza scarpe: vanno tolte all'ingresso.",
    "Puoi lasciare borse e zaini nell'area indicata dallo staff, tenendo con te gli oggetti di valore.",
    "È vietato fumare all'interno, incluso vape.",
    "Non sono ammessi drink aperti nell'area corde: solo bottiglie o contenitori chiusi.",
    "L'acqua potabile è disponibile in cucina.",
  ];
  return emailSection(en?"Venue Rules & Etiquette":"Regole dello spazio & etichetta",
    list(rules)+(jam?'<div style="margin-top:16px;">'+emailButton(en?"Read Rope Jam guidelines":"Leggi il vademecum Rope Jam",vademecum)+"</div>":""));
}
function lunchFacilities(en:boolean):string{
  const body=en?[
    "There are several restaurants and supermarkets around the studio. Some may close during lunch or on Sunday; please check their current opening hours.",
    "In Italy, many restaurant kitchens close around 14:00–14:30. Depending on the class, the lunch break may start around that time.",
    "You are welcome to use the studio kitchen. It includes a refrigerator, microwave and kettle, plus plates, glasses and cutlery. You can bring food or takeaway.",
  ]:[
    "Nelle vicinanze ci sono ristoranti e supermercati. Alcuni chiudono a pranzo o la domenica: verifica gli orari aggiornati.",
    "Molte cucine dei ristoranti chiudono intorno alle 14:00–14:30. L'orario della pausa dipende dall'andamento del workshop.",
    "Puoi usare la cucina dello studio, con frigorifero, microonde, bollitore, piatti, bicchieri e posate. Puoi portare il pranzo o cibo da asporto.",
  ];
  return emailSection(en?"Lunch and Facilities":"Pausa pranzo e servizi",
    body.map(paragraphs).join("")+emailButton(en?"Map of lunch spots and facilities":"Mappa dei locali e servizi vicini",lunchMapUrl));
}
function photoPolicy(en:boolean):string {
  return emailBox(en?"Photo / Video Policy":"Foto e video",
    list(en?[
      "Photos may be taken during exercise demonstrations.",
      "Video and audio recordings are prohibited unless the teachers explicitly allow them.",
      "Photos of your partner during practice require their explicit consent.",
      "Every identifiable person in a photo must explicitly consent; otherwise do not include them.",
      "Recording devices such as smart glasses are not allowed.",
    ]:[
      "È possibile scattare foto durante le dimostrazioni, secondo le indicazioni dei docenti.",
      "Non sono consentite registrazioni audio o video salvo esplicita autorizzazione.",
      "Le foto del partner richiedono il suo consenso esplicito.",
      "Ogni persona riconoscibile deve aver dato il proprio consenso.",
      "Non sono ammessi dispositivi di registrazione come smart glasses.",
    ]));
}
function association(en:boolean,context?:PeonyEmailEventContext):string{
  const until=periodUntil(context);
  return emailBox(en?"Registration to the Studio Cultural Association":"Iscrizione all'associazione",
    paragraphs(en?
      "All participants who practise, including partners, must be members of UR Expression APS. Registration must be completed at least 48 hours before the event. The membership fee is €15 per person.":
      "Ogni praticante, incluso il partner, deve essere associato a UR Expression APS almeno 48 ore prima dell'evento. La quota è di 15 € a persona.") +
    (until?paragraphs(en?
      "For this event, the current association membership is valid until "+until+
      ". If you are already registered and your fee is valid, you do not need to register or pay again.":
      "La quota per questo evento è valida fino al "+until+
      ". Se sei già associata/o e la quota è valida, non devi ripetere la registrazione o il pagamento."): "")+
    paragraphs(en?
      "If you or your partner still need to register, complete the form below. Reply to this email if you need help.":
      "Se tu o il tuo partner dovete ancora associarvi, compilate il modulo. Per qualsiasi dubbio rispondete a questa email.")+
    emailButton(en?"Association registration form":"Modulo associativo",peonyAssociationFormUrl(en?"en":"it")));
}
function emergency(en:boolean):string {
  return emailBox(en?"Emergency Contact":"Contatto di emergenza",
    paragraphs(en?
      "For urgent assistance on the day of the event, call Andrea at +39 320 648 6577 (WhatsApp / Telegram).":
      "Per qualsiasi necessità il giorno dell'evento, chiama Andrea al +39 320 648 6577 (anche WhatsApp/Telegram)."));
}
function workshopSections(input:{
  dateLabel:string;context?:PeonyEmailEventContext;fields:PeonyEmailDetailFields;language:PeonyEmailLanguage;
}):string{
  const {fields,context}=input;const en=input.language==="en";const parts:string[]=[];
  if(fields.optionalActivityTitle?.trim()){
    parts.push(emailBox(fields.optionalActivityTitle,paragraphs(fields.optionalActivityInfo)+
      (safeUrl(fields.optionalActivityUrl)?emailButton(en?"Book the activity":"Prenota l'attività",fields.optionalActivityUrl!):"")));
  }
  const glance=
    line(en?"Dates:":"Date:",dateRange(input))+
    line(en?"Doors Open:":"Apertura porte:",fields.doorsOpen)+
    line(en?"Time:":"Orario:",[fields.dailyStart,fields.dailyEnd].filter(Boolean).join(" – "))+paragraphs(fields.arrivalNote);
  parts.push(emailBox(en?"Important at a glance":"Informazioni essenziali",glance));
  const detailedSchedule=
    line(en?"Doors Open:":"Apertura porte:",fields.doorsOpen)+
    line(en?"Start:":"Inizio:",fields.dailyStart)+
    line(en?"Lunch break:":"Pausa pranzo:",fields.lunchBreak)+
    line(en?"End:":"Fine:",fields.dailyEnd)+
    (!fields.dailyStart&&context?.startTime?
      line(en?"Ticket Tailor event start:":"Inizio evento su Ticket Tailor:",context.startTime):"");
  parts.push(emailSection(en?"Event Schedule":"Programma e orari",
    (dateRange(input)?'<p style="margin:0 0 16px;"><strong>'+escapeHtml(input.dateLabel)+"</strong></p>":"")+detailedSchedule));
  const workshopInfo=
    (fields.includeTicketTailorDescription===false?"":paragraphs(context?.description))+
    paragraphs(fields.program)+line(en?"Partners:":"Partner:",fields.partnerPolicy);
  if (workshopInfo.trim()) parts.push(emailSection(en?"Workshop Information":"Informazioni sul workshop",workshopInfo));
  const bring=line(en?"Ropes:":"Corde:",fields.ropes)+line(en?"Attire:":"Abbigliamento:",fields.clothing);
  if(bring) parts.push(emailSection(en?"What to Bring":"Cosa portare",bring));
  const prereq=paragraphs(fields.prerequisites)+
    (fields.riggersPrerequisites?.trim()?'<p style="margin:0 0 8px;"><strong>Riggers</strong></p>'+paragraphs(fields.riggersPrerequisites):"")+
    (fields.modelsPrerequisites?.trim()?'<p style="margin:0 0 8px;"><strong>Models</strong></p>'+paragraphs(fields.modelsPrerequisites):"");
  if(prereq)parts.push(emailBox(en?"Prerequisites":"Prerequisiti",prereq));
  parts.push(place(en),...access(en,true),lunchFacilities(en),venueRules(en,false),photoPolicy(en),association(en,context));
  if(fields.extraNotes?.trim())parts.push(emailSection(en?"Additional Information":"Ulteriori informazioni",paragraphs(fields.extraNotes)));
  parts.push(emergency(en));
  return parts.join("");
}
function jamSections(input:{
  eventTitle:string;dateLabel:string;context?:PeonyEmailEventContext;
  fields:PeonyEmailDetailFields;language:PeonyEmailLanguage;audience:PeonyEmailAudience;
}):string{
  const {fields,context}=input;const en=input.language==="en";const observer=input.audience==="observer";
  const exempt=observer||/aperi[\s-]*bottom|free event|evento free/i.test(input.eventTitle);
  const parts:string[]=[];
  if(observer)parts.push(emailBox(en?"As an observer, please remember":"Come observer, ricordati che",
    list(en?[
      "You may observe and socialize, but cannot tie or be tied.",
      "Association membership is not required.",
      "No additional payment is due at the venue; your ticket was purchased through Ticket Tailor. No rope voucher is included.",
      "Observer admission is allowed only once. To practise in the future, you must become a member.",
    ]:[
      "Puoi osservare e socializzare, ma non legare né essere legata/o.",
      "Non sei tenuta/o a iscriverti all'associazione.",
      "Il biglietto è già stato acquistato su Ticket Tailor: nessun altro pagamento è dovuto all'ingresso e non è previsto il buono corde.",
      "L'ingresso come observer è possibile una sola volta. Per praticare in futuro sarà necessario associarsi.",
    ])));
  else if (!exempt) parts.push(emailBox(en?"First time at Peony Studio?":"Prima volta a Peony Studio?",
    paragraphs(en?"If this is your first visit, please have your ticket QR code ready at the entrance.":
      "Se non sei mai venuta/o a Peony Studio, presenta il QR code del biglietto all'ingresso.")));
  const start=fields.dailyStart??context?.startTime;
  const end=fields.dailyEnd??context?.endTime;
  parts.push(emailSection(en?"Evening Schedule":"Programma della serata",
    '<p style="margin:0 0 16px;"><strong>'+escapeHtml([start,end].filter(Boolean).join("–")||input.dateLabel)+"</strong></p>"+
    line(en?"Doors Open:":"Apertura porte:",fields.doorsOpen??start)+
    line(en?"Last Entry:":"Ultimo ingresso:",fields.lastEntry)+
    line(en?"End:":"Fine evento:",end)+
    (fields.extraNotes?.trim()?paragraphs(fields.extraNotes):"")));
  parts.push(place(en),...access(en,false),venueRules(en,isRopeJamEvent(input.eventTitle)));
  if(!exempt)parts.push(emailBox(en?"Association":"Associazione",
    paragraphs(en?
      "To practise at Peony Studio you must be a member of UR Expression APS. If you are already a member, no action is required. Otherwise, register at least 48 hours before the event. The membership fee is €15 per person.":
      "Per partecipare come praticante devi essere associata/o a UR Expression APS. Se sei già associata/o non devi fare nulla. Altrimenti completa la registrazione almeno 48 ore prima dell'evento. La quota associativa è di 15 € a persona.")+
    paragraphs(en?
      "New members receive a €10 voucher when purchasing a set of at least four ropes.":
      "I nuovi associati ricevono un buono da 10 € per un set di almeno quattro corde.")+
    emailButton(en?"Association registration form":"Modulo associativo",peonyAssociationFormUrl(input.language))));
  parts.push(emergency(en));
  return parts.join("");
}

/** Reference-email structure, with event-specific data from TT or explicit editor fields. */
export function peonyInformativeSections(input:{
  eventTitle:string;dateLabel:string;context?:PeonyEmailEventContext;
  fields?:PeonyEmailDetailFields;language:PeonyEmailLanguage;audience?:PeonyEmailAudience;
}):string {
  const fields=input.fields??{};
  if(isRopeJamEvent(input.eventTitle)||!isWorkshopEvent(input.eventTitle,input.context))
    return jamSections({...input,fields,audience:input.audience??"practitioner"});
  return workshopSections({...input,fields});
}
