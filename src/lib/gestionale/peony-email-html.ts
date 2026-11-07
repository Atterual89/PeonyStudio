import { emailAssets, emailButton, escapeHtml } from "@/lib/gestionale/email/layout";

export type PeonyEmailKind = "membership" | "partner" | "details";
export type PeonyEmailTemplate = { subject: string; body: string };
export const PEONY_EMAIL_KINDS: { id: PeonyEmailKind; label: string }[] = [
  { id: "membership", label: "Iscrizione associazione" },
  { id: "partner", label: "Registrazione partner" },
  { id: "details", label: "Informazioni corso" },
];

export function defaultPeonyEmailTemplate(
  kind: PeonyEmailKind,
  title: string,
  dateLabel: string,
): PeonyEmailTemplate {
  if (kind === "membership") {
    return {
      subject: `Peony Studio | Iscrizione all'associazione – ${title}`,
      body: `Ciao,\n\nti scriviamo perché hai prenotato un posto per ${title} (${dateLabel}).\n\nPer partecipare come praticante è necessario essere iscritti all'associazione UR Expression APS. Se non hai ancora completato la registrazione, ti chiediamo di farlo almeno 48 ore prima dell'evento. La quota associativa è di 15 € a persona.\n\nIl modulo di iscrizione è raggiungibile dal pulsante qui sotto. Se hai già compilato il modulo o pagato la quota, rispondi a questa email e faremo una verifica.\n\nGrazie,\nPeony Studio`,
    };
  }
  if (kind === "partner") {
    return {
      subject: `Peony Studio | Dati partner – ${title}`,
      body: `Ciao,\n\nper completare le verifiche associative per ${title} (${dateLabel}), abbiamo bisogno di sapere chi parteciperà insieme a te.\n\nTi chiediamo di rispondere indicando nome, cognome e, se disponibile, email della persona con cui verrai. Entrambe le persone che praticano devono risultare iscritte all'associazione UR Expression APS almeno 48 ore prima dell'evento.\n\nSe hai già fornito i dati nel modulo d'ordine, questa richiesta può essere ignorata: li verificheremo.\n\nGrazie,\nPeony Studio`,
    };
  }
  return {
    subject: `Peony Studio | Informazioni – ${title}`,
    body: `Ciao,\n\nci fa piacere averti con noi per ${title} (${dateLabel}).\n\n[Inserisci qui gli orari effettivi del corso, il materiale da portare e le informazioni specifiche prima dell'invio.]\n\nLo studio è a Torino, vicino alla fermata metro Marche. Al citofono trovi UR Expression, piano -1.\n\nPer qualsiasi domanda, puoi rispondere a questa email.\n\nA presto,\nPeony Studio`,
  };
}

/** HTML email completo, compatibile con copia/incolla in Gmail. Tutto il testo editabile e' escapato. */
export function buildPeonyEmailHtml(input: {
  kind: PeonyEmailKind;
  eventTitle: string;
  dateLabel: string;
  template: PeonyEmailTemplate;
}): string {
  const text = input.template.body.trim().split(/\n\s*\n/).map((paragraph) =>
    '<p style="margin:0 0 18px;font-size:16px;line-height:1.75;">' +
    paragraph.split(/\r?\n/).map(escapeHtml).join("<br>") + "</p>"
  ).join("");
  const heading = PEONY_EMAIL_KINDS.find((k) => k.id === input.kind)?.label ?? input.template.subject;
  const cta = input.kind === "membership"
    ? '<div style="margin:22px 0;">' + emailButton("Compila il modulo associativo", "https://forms.gle/bgc9cx2c79rYayXj8") + "</div>"
    : "";
  return '<!doctype html><html lang="it"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">' +
    '<title>' + escapeHtml(input.template.subject) + '</title></head>' +
    '<body style="margin:0;padding:0;background:#e9e0d3;font-family:Arial,Helvetica,sans-serif;color:#302822;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#e9e0d3"><tr><td align="center" style="padding:16px 8px">' +
    '<table role="presentation" width="680" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:680px;background:#f8f1e6;border:1px solid #b7a998;">' +
    '<tr><td align="center" style="padding:28px 20px;border-bottom:1px solid #c7b9a8">' +
    '<img src="' + emailAssets.logo + '" alt="Peony Studio" width="190" style="display:block;width:190px;max-width:65%;height:auto;margin:auto;border:0">' +
    '<div style="font-family:Georgia,serif;font-size:28px;color:#741f2d;margin:20px 0 8px;">' + escapeHtml(input.eventTitle) + '</div>' +
    '<div style="font-size:13px;color:#5f524c;">' + escapeHtml(input.dateLabel) + '</div></td></tr>' +
    '<tr><td style="padding:28px 30px 24px;">' +
    '<h1 style="font:600 23px Georgia,serif;color:#741f2d;margin:0 0 22px;">' + escapeHtml(heading) + '</h1>' +
    text + cta + '</td></tr><tr><td style="padding:22px 30px;background:#1d1814;color:#f8f1e6;font-size:13px;text-align:center;">' +
    '<strong>Peony Studio · Torino</strong><div style="margin-top:10px">' +
    '<a href="https://peonystudio.net/" style="color:#f8f1e6;">Sito web</a> · ' +
    '<a href="https://www.instagram.com/peony.studio.turin/" style="color:#f8f1e6;">Instagram</a>' +
    '</div></td></tr></table></td></tr></table></body></html>';
}
