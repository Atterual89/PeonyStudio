import { emailAssets, emailBox, emailButton, emailParagraph, emailSection, escapeHtml } from "@/lib/gestionale/email/layout";
import { membershipPeriodForPayment } from "@/lib/association/membership-periods";

/** Event-specific information synced from Ticket Tailor. Never infer missing schedule or equipment. */
export type PeonyEmailEventContext = {
  category: string | null;
  startsOn: string | null;
  endsOn: string | null;
  startTime: string | null;
  endTime: string | null;
  description: string | null;
  bookingUrl: string | null;
};

export type PeonyEmailAudience = "practitioner" | "observer";
export type PeonyEmailLanguage = "it" | "en";

export function isRopeJamEvent(title: string): boolean {
  return /rope\s*jam/i.test(title);
}
export function isWorkshopEvent(title: string, context?: PeonyEmailEventContext): boolean {
  return ["workshop", "percorso"].includes(context?.category ?? "") ||
    /workshop|kinbaku|foundation|neck rope|dimensions/i.test(title);
}
export function peonyEmailLanguage(title: string, context?: PeonyEmailEventContext): PeonyEmailLanguage {
  return isWorkshopEvent(title, context) ? "en" : "it";
}

const address = "Peony Studio, Via Vandalino 85/38, Torino";
const mapsUrl = "https://maps.app.goo.gl/CnoZpoZmgzP3Absg9";
const italianForm = "https://forms.gle/NQTquvXUkcqeFSZbA";
const englishForm = "https://forms.gle/bgc9cx2c79rYayXj8";
const vademecum = "https://peonystudio.net/vademecum-rope-jam";

/** Render the event date in the chosen email language (not the admin UI locale). */
export function formatPeonyEmailDate(
  context:PeonyEmailEventContext, fallback:string, language:PeonyEmailLanguage,
):string {
  const start=context.startsOn;
  if(!start || !/^\d{4}-\d{2}-\d{2}$/.test(start))return language==="en"?"Date to be confirmed":fallback;
  const end=context.endsOn && /^\d{4}-\d{2}-\d{2}$/.test(context.endsOn) ?
    context.endsOn : start;
  const locale=language==="en"?"en-GB":"it-IT";
  const long=(day:string)=>new Intl.DateTimeFormat(locale,{
    day:"numeric",month:"long",year:"numeric",timeZone:"UTC",
  }).format(new Date(day+"T12:00:00Z"));
  if(end===start)return long(start);
  if(start.slice(0,7)===end.slice(0,7)){
    const first=Number(start.slice(8,10));
    return first+"–"+long(end);
  }
  return long(start)+" – "+long(end);
}

export function peonyAssociationFormUrl(language: PeonyEmailLanguage): string {
  return language === "en" ? englishForm : italianForm;
}

function lines(items: string[]): string {
  return '<ul style="margin:0;padding-left:22px;">' + items.map((item) =>
    '<li style="margin-bottom:8px;">' + escapeHtml(item) + "</li>").join("") + "</ul>";
}

function descriptionFromTicketTailor(description: string): string {
  const safeText = description.trim().slice(0, 5500);
  if (!safeText) return "";
  return '<p style="margin:0 0 12px;white-space:normal;">' +
    escapeHtml(safeText).replace(/\r?\n/g, "<br>") + "</p>";
}

function eventTimes(context?: PeonyEmailEventContext): string | null {
  if (!context?.startTime || context.startTime === "00:00") return null;
  const start = context.startTime;
  const end = context.endTime && context.endTime !== "00:00" && context.endTime !== start ?
    " – " + context.endTime : "";
  return start + end;
}

function membershipPeriodText(context: PeonyEmailEventContext | undefined, language: PeonyEmailLanguage): string {
  const period = context?.startsOn ? membershipPeriodForPayment(new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" })) : null;
  if (!period) return "";
  const [year, month, day] = period.validUntil.split("-");
  return language === "it" ?
     "La quota versata ora è valida fino al " + day + "/" + month + "/" + year + "." :
     "Membership paid now is valid until " + day + "/" + month + "/" + year + ".";
}

/** Static Peony information and conditional sections are shared by all emails of a cluster. */
export function peonyEmailSections(input: {
  kind: "membership" | "partner" | "details";
  eventTitle: string;
  context?: PeonyEmailEventContext;
  audience?: PeonyEmailAudience;
  language?: PeonyEmailLanguage;
}): string {
  const language = input.language ?? peonyEmailLanguage(input.eventTitle, input.context);
  const en = language === "en";
  const jam = isRopeJamEvent(input.eventTitle);
  const workshop = isWorkshopEvent(input.eventTitle, input.context);
  const observer = input.audience === "observer";
  const formUrl = peonyAssociationFormUrl(language);
  const periodText = membershipPeriodText(input.context, language);
  const associationRequired = !observer && !/aperi[\s-]*bottom|free event|evento free/i.test(input.eventTitle);
  const parts: string[] = [];

  if (input.kind === "membership") {
    parts.push(emailBox(en ? "Association registration" : "Iscrizione all'associazione",
      emailParagraph(en ?
        "To practise at Peony Studio you must be a member of UR Expression APS. Complete the form at least 48 hours before the event. The membership fee is €15 per person." :
        "Per praticare a Peony Studio devi essere associata/o a UR Expression APS. Compila il modulo almeno 48 ore prima dell'evento. La quota è di 15 € a persona.") +
      (periodText ? emailParagraph(periodText) : "") +
      emailButton(en ? "Association form" : "Modulo associativo", formUrl)));
  } else if (input.kind === "partner") {
    parts.push(emailBox(en ? "Partner information required" : "Dati del partner richiesti",
      emailParagraph(en ?
        "Reply to this email with your partner's name and, if available, their email address. We will match the two registrations manually." :
        "Rispondi indicando il nome del partner e, se disponibile, la sua email. Abbineremo manualmente le due iscrizioni.") +
      emailParagraph(en ?
        "If your partner is not yet a member, share the association form with them. Each practitioner must register at least 48 hours before the event." :
        "Se il partner non è ancora associato, condividi il modulo. Ogni praticante deve associarsi almeno 48 ore prima dell'evento.") +
      (periodText ? emailParagraph(periodText) : "") +
      emailButton(en ? "Association form" : "Modulo associativo", formUrl)));
  } else {
    const time = eventTimes(input.context);
    if (time) parts.push(emailBox(en ? "Event schedule · Ticket Tailor" : "Orario evento · Ticket Tailor",
      emailParagraph((en ? "Time shown on Ticket Tailor: " : "Orario indicato su Ticket Tailor: ") + time) +
      (workshop ? emailParagraph(en ?
        "For daily opening, lunch breaks and the detailed schedule, check the event description or the organizer's notes." :
        "Per apertura porte, pause e programma dettagliato consulta la descrizione o le note dell'organizzazione.") : "")));
    const desc = input.context?.description;
    if (desc?.trim()) parts.push(emailSection(en ? "Event information · Ticket Tailor" : "Informazioni evento · Ticket Tailor",
      descriptionFromTicketTailor(desc)));
    if (input.context?.bookingUrl?.startsWith("https://")) {
      parts.push(emailSection(en ? "Event page" : "Pagina evento",
        emailButton(en ? "See event on Ticket Tailor" : "Apri l'evento su Ticket Tailor",
          input.context.bookingUrl)));
    }
    if (observer) {
      parts.push(emailBox(en ? "Observer ticket" : "Biglietto observer",
        emailParagraph(en ?
          "As an observer you may watch and socialize, but you cannot tie or be tied. Association membership is not required." :
          "Come observer puoi osservare e socializzare, ma non legare né essere legata/o. Non è richiesta l'iscrizione all'associazione.") +
        emailParagraph(en ?
          "Your ticket was booked through Ticket Tailor. No payment is required at the door and no rope voucher is included." :
          "L'iscrizione e il pagamento sono avvenuti tramite Ticket Tailor. Non è richiesto un altro pagamento all'ingresso e non è previsto il buono corde.") +
        emailParagraph(en ?
          "Observer admission is allowed only once. To practise in future activities, you must join the association." :
          "L'accesso come observer è consentito una sola volta. Per praticare in futuro sarà necessario associarsi.")));
    } else if (jam) {
      parts.push(emailBox("Rope Jam",
        emailParagraph("Se è la tua prima visita, tieni pronto il QR code del biglietto all'ingresso.") +
        (associationRequired ? emailParagraph("Per partecipare come praticante occorre essere associati a UR Expression APS. Se sei già associata/o e la quota è valida, non devi ripeterla. I nuovi associati ricevono un buono di 10 € per un set di almeno quattro corde.") : "") +
        emailButton("Leggi il vademecum Rope Jam", vademecum)));
    }
    if (workshop && associationRequired) {
      parts.push(emailBox(en ? "Association reminder" : "Promemoria associazione",
        emailParagraph(en ?
          "Each person practising, including the partner, must be a member of UR Expression APS at least 48 hours before the event. The fee is €15 per person." :
          "Ogni praticante, incluso il partner, deve essere associato a UR Expression APS almeno 48 ore prima dell'evento. La quota è di 15 € a persona.") +
        (periodText ? emailParagraph(periodText) : "") +
        emailButton(en ? "Association form (if needed)" : "Modulo associativo (se necessario)", formUrl)));
    }
  }

  parts.push(emailSection(en ? "Location & arrival" : "Dove siamo",
    emailParagraph(address + (en ? ". Intercom: UR Expression, floor -1." : ". Citofono: UR Expression, piano -1.")) +
    emailButton(en ? "Find us on Google Maps" : "Apri Google Maps", mapsUrl) +
    '<img src="' + emailAssets.entrance + '" alt="Ingresso Peony Studio" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;margin:18px auto 0;">'));

  if (input.kind === "details") {
    parts.push(emailBox(en ? "How to enter" : "Come accedere",
      lines(en ? [
        "Metro: Marche, exit Via Eritrea, around five minutes on foot.",
        "Do not gather in front of the residential building.",
        "Use the UR Expression intercom and go to floor -1.",
        "Please keep quiet in the stairwell.",
      ] : [
        "Metro: fermata Marche, uscita Via Eritrea, circa cinque minuti a piedi.",
        "Non sostare in gruppo davanti all'ingresso del palazzo.",
        "Citofono UR Expression, piano -1.",
        "Mantieni il silenzio sulle scale: il palazzo è abitato.",
      ])));
    parts.push(emailSection(en ? "Venue rules" : "Regole dello spazio",
      lines(en ? [
        "No shoes inside the studio.",
        "Smoking and vaping are not allowed indoors.",
        "In the rope area only bottles and closed drink containers are allowed.",
        "Keep valuables with you; drinking water is available in the kitchen.",
      ] : [
        "Lo studio è uno spazio senza scarpe.",
        "Non è permesso fumare o svapare all'interno.",
        "Nell'area corde sono consentite solo bottiglie o contenitori chiusi.",
        "Tieni con te gli oggetti di valore; in cucina trovi acqua potabile.",
      ])));
    if (workshop) {
      parts.push(emailSection(en ? "Lunch and facilities" : "Pausa pranzo e servizi",
        emailParagraph(en ?
          "The studio has a fridge, microwave and kettle. You may bring lunch. Please check nearby restaurants' opening hours, especially on Sundays." :
          "Lo studio dispone di frigorifero, microonde e bollitore. Puoi portare il pranzo. Verifica gli orari dei locali vicini, specialmente la domenica.")));
      parts.push(emailBox(en ? "Photos & recordings" : "Foto e registrazioni",
        emailParagraph(en ?
          "Photos require consent from anyone identifiable. Audio and video recordings are not permitted unless explicitly authorized by the teachers." :
          "Le foto richiedono il consenso delle persone riconoscibili. Registrazioni audio e video non sono consentite salvo autorizzazione dei docenti.")));
    }
    parts.push(emailBox(en ? "Emergency contact" : "Contatto di emergenza",
      emailParagraph((en ? "For help during the event: " : "Per necessità durante l'evento: ") +
        "+39 320 648 6577 (Andrea, WhatsApp/Telegram).")));
  }
  return parts.join("");
}
