import { emailAssets, escapeHtml } from "@/lib/gestionale/email/layout";
import { peonyInformativeSections, type PeonyEmailDetailFields } from "@/lib/gestionale/peony-email-details";
import {
  peonyEmailLanguage, peonyEmailSections,
  type PeonyEmailAudience, type PeonyEmailEventContext, type PeonyEmailLanguage,
} from "@/lib/gestionale/peony-email-context";

export type PeonyEmailKind = "membership" | "partner" | "details";
export type PeonyEmailTemplate = { subject: string; body: string };
export const PEONY_EMAIL_KINDS: { id: PeonyEmailKind; label: string }[] = [
  { id: "membership", label: "Iscrizione associazione" },
  { id: "partner", label: "Dati partner" },
  { id: "details", label: "Informazioni evento" },
];

/** Store placeholders so saved templates continue to reflect changes in Ticket Tailor. */
export function resolvePeonyTemplateText(text: string, eventTitle: string, dateLabel: string): string {
  return text.replace(/\{\{\s*event_title\s*\}\}/gi, eventTitle)
    .replace(/\{\{\s*event_date\s*\}\}/gi, dateLabel);
}

/** The editable text is the introduction only; shared instructions come from modules. */
export function defaultPeonyEmailTemplate(
  kind: PeonyEmailKind,
  _title: string,
  _dateLabel: string,
  language: PeonyEmailLanguage = "it",
): PeonyEmailTemplate {
  const en = language === "en";
  if (kind === "membership") return en ? {
    subject: "Peony Studio | Association registration – {{event_title}}",
    body: "Dear,\n\nYou are receiving this email because you have booked a place for {{event_title}} ({{event_date}}). Please complete the association registration if you are not yet a member.\n\nIf you have already registered and paid, please reply so we can verify your membership.",
  } : {
    subject: "Peony Studio | Iscrizione all'associazione – {{event_title}}",
    body: "Ciao,\n\nhai prenotato un posto per {{event_title}} ({{event_date}}). Se non sei ancora associata/o, ti chiediamo di completare la registrazione.\n\nSe hai già compilato il modulo e pagato la quota, rispondi a questa email per una verifica.",
  };
  if (kind === "partner") return en ? {
    subject: "Peony Studio | Partner information required – {{event_title}}",
    body: "Dear,\n\nYou are registered for {{event_title}} ({{event_date}}), but we still need to identify the person with whom you will practise.\n\nIf your partner is already a member, let us know their name. Otherwise, they can register using the form below.",
  } : {
    subject: "Peony Studio | Dati partner richiesti – {{event_title}}",
    body: "Ciao,\n\nper {{event_title}} ({{event_date}}) dobbiamo ancora identificare la persona con cui parteciperai.\n\nSe è già associata, indicaci il suo nome. Altrimenti può iscriversi dal modulo qui sotto.",
  };
  return en ? {
    subject: "Peony Studio | Practical information – {{event_title}}",
    body: "Dear,\n\nWe're looking forward to welcoming you to {{event_title}} ({{event_date}}). Below you'll find the event details and practical information.\n\nPlease read this email until the end.",
  } : {
    subject: "Peony Studio | Informazioni – {{event_title}}",
    body: "Ciao,\n\ngrazie per l'iscrizione a {{event_title}} ({{event_date}}). Qui sotto trovi le informazioni sull'evento e le indicazioni per raggiungerci.",
  };
}

function richParagraphs(body: string): string {
  return body.trim().split(/\n\s*\n/).filter(Boolean).map((paragraph) =>
    '<p style="margin:0 0 18px;font-size:16px;line-height:1.75;">' +
    paragraph.split(/\r?\n/).map(escapeHtml).join("<br>") + "</p>").join("");
}

/** Gmail-safe HTML. Text is escaped, shared blocks are generated once, data is read from TT. */
export function buildPeonyEmailHtml(input: {
  kind: PeonyEmailKind;
  eventTitle: string;
  dateLabel: string;
  template: PeonyEmailTemplate;
  context?: PeonyEmailEventContext;
  audience?: PeonyEmailAudience;
  language?: PeonyEmailLanguage;
  detailFields?: PeonyEmailDetailFields;
}): string {
  const language = input.language ?? peonyEmailLanguage(input.eventTitle, input.context);
  const en = language === "en";
  const heading = input.kind === "membership" ?
    (en ? "Association registration" : "Iscrizione all'associazione") :
    input.kind === "partner" ? (en ? "Partner information" : "Dati partner") :
    input.audience === "observer" ? "Observer" :
    (en ? "Practical information" : "Informazioni evento");
  const sections = input.kind === "details" ?
    peonyInformativeSections({
      eventTitle:input.eventTitle,dateLabel:input.dateLabel,
      context:input.context,fields:input.detailFields,
      audience:input.audience,language,
    }) : peonyEmailSections({
      kind: input.kind, eventTitle: input.eventTitle, context: input.context,
      audience: input.audience, language,
    });
  return '<!doctype html><html lang="' + language + '"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">' +
    '<title>' + escapeHtml(resolvePeonyTemplateText(input.template.subject,input.eventTitle,input.dateLabel)) + '</title></head>' +
    '<body style="margin:0;padding:0;background:#e9e0d3;font-family:Arial,Helvetica,sans-serif;color:#302822;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#e9e0d3"><tr><td align="center" style="padding:16px 8px">' +
    '<table role="presentation" width="680" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:680px;background:#f8f1e6;border:1px solid #b7a998;">' +
    '<tr><td align="center" style="padding:30px 20px 26px;border-bottom:1px solid #c7b9a8">' +
    '<img src="' + emailAssets.logo + '" alt="Peony Studio" width="190" style="display:block;width:190px;max-width:65%;height:auto;margin:auto;border:0">' +
    '<div style="font-size:12px;letter-spacing:.22em;text-transform:uppercase;font-weight:700;color:#8f2635;margin-top:16px;">PEONY STUDIO</div>' +
    '<div style="font:italic 600 36px Georgia,Times New Roman,serif;color:#1d1814;margin:14px 0 8px;">' + escapeHtml(input.eventTitle) + '</div>' +
    '<div style="width:120px;height:3px;background:#8f2635;margin:0 auto 12px;"></div>' +
    '<div style="font-size:14px;font-weight:bold;color:#6d2630;">' + escapeHtml(input.dateLabel) + '</div></td></tr>' +
    '<tr><td style="padding:30px 38px 10px;">' +
    (input.kind === "details" ? "" :
      '<h1 style="font:600 25px Georgia,serif;color:#741f2d;margin:0 0 20px;">' + escapeHtml(heading) + '</h1>') +
    richParagraphs(resolvePeonyTemplateText(input.template.body,input.eventTitle,input.dateLabel)) + '</td></tr>' +
    sections +
    '<tr><td style="padding:30px 38px 36px;font-size:15px;line-height:1.7;">' +
    (en ? "For any questions, just reply to this email." : "Per qualsiasi domanda puoi rispondere a questa email.") +
    '<p style="margin:12px 0 0;"><strong>Peony Studio</strong></p></td></tr>' +
    '<tr><td style="padding:28px 30px;background:#1d1814;color:#f8f1e6;font-size:13px;text-align:center;">' +
    '<strong>Peony Studio · Torino</strong><div style="margin-top:10px">' +
    '<a href="https://peonystudio.net/" style="color:#f8f1e6;">' + (en ? "Website" : "Sito web") + '</a> · ' +
    '<a href="https://www.instagram.com/peony.studio.turin/" style="color:#f8f1e6;">Instagram</a> · ' +
    '<a href="https://www.tickettailor.com/events/peonystudio1" style="color:#f8f1e6;">Ticket Tailor</a>' +
    '</div></td></tr></table></td></tr></table></body></html>';
}
