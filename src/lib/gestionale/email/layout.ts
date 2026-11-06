/** Shared Gmail-safe HTML design system from the original Peony Level 2+ email. */
export const emailAssets = {
  logo: "https://peonystudio.net/email/peony-logo.png",
  entrance: "https://peonystudio.net/email/peony-entrance.jpg",
} as const;

export function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function emailParagraph(text: string): string {
  return '<p style="margin:0 0 16px;">' + escapeHtml(text) + "</p>";
}

export function emailList(items: readonly string[]): string {
  if (!items.length) return "";
  return '<ul style="margin:0;padding-left:22px;font-size:16px;line-height:1.75;">' +
    items.filter(Boolean).map((item) => '<li style="margin-bottom:8px;">' + escapeHtml(item) + "</li>").join("") + "</ul>";
}

export function emailButton(label: string, url: string): string {
  if (!/^https:\/\//i.test(url)) return "";
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#8f2635;border-radius:5px;padding:13px 20px;">' +
    '<a href="' + escapeHtml(url) + '" style="color:#fff7ec;font-size:15px;font-weight:bold;text-decoration:none;">' +
    escapeHtml(label) + "</a></td></tr></table>";
}

export function emailSection(title: string, body: string): string {
  if (!body.trim()) return "";
  return '<tr><td style="padding:30px 38px 4px;">' +
    '<div style="font-family:Georgia,Times New Roman,serif;font-size:27px;line-height:1.2;color:#741f2d;margin-bottom:14px;">' +
    escapeHtml(title) + '</div><div style="width:54px;height:2px;background:#d6b78a;margin-bottom:18px;"></div>' +
    '<div style="font-size:16px;line-height:1.75;">' + body + "</div></td></tr>";
}

export function emailBox(title: string, body: string): string {
  if (!body.trim()) return "";
  return '<tr><td style="padding:26px 38px 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0e4d6;border-left:4px solid #8f2635;border-radius:12px;">' +
    '<tr><td style="padding:19px 20px;"><div style="font-family:Georgia,Times New Roman,serif;font-size:21px;line-height:1.3;color:#8f2635;font-weight:bold;margin-bottom:10px;">◆ ' +
    escapeHtml(title) + '</div><div style="font-size:16px;line-height:1.75;">' + body +
    "</div></td></tr></table></td></tr>";
}

export type EmailLayoutInput = {
  workshopTitle: string;
  dateLabel: string;
  intro: string;
  sections: string[];
  preview?: string;
  signature?: string;
};

export function peonyEmailLayout(input: EmailLayoutInput): string {
  const header = '<tr><td align="center" style="padding:30px 36px 26px;border-bottom:1px solid #c7b9a8;">' +
    '<img src="' + emailAssets.logo + '" alt="Peony Studio" width="190" style="display:block;width:190px;max-width:66%;height:auto;margin:0 auto;border:0;">' +
    '<div style="font-size:12px;line-height:18px;letter-spacing:.22em;text-transform:uppercase;font-weight:700;color:#8f2635;margin-top:16px;">PEONY STUDIO</div>' +
    '<div style="font-family:Georgia,Times New Roman,serif;font-size:38px;line-height:1.1;font-style:italic;font-weight:600;color:#1d1814;margin:14px 0 8px;">' + escapeHtml(input.workshopTitle) + '</div>' +
    '<div style="width:120px;height:3px;background:#8f2635;margin:0 auto 12px;"></div>' +
    '<div style="font-size:14px;line-height:20px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6d2630;">' + escapeHtml(input.dateLabel) + "</div></td></tr>";
  const intro = '<tr><td style="padding:34px 38px 8px;font-size:16px;line-height:1.75;"><p style="margin:0 0 18px;">Dear,</p>' +
    input.intro + "</td></tr>";
  const footer = '<tr><td style="padding:28px 38px 35px;border-top:1px solid #c7b9a8;font-size:15px;line-height:1.7;">' +
    'Thank you for your cooperation,<p style="margin:10px 0 0;"><strong>' + escapeHtml(input.signature || "Peony Studio Staff") + '</strong></p></td></tr>' +
    '<tr><td align="center" style="padding:28px 40px 32px;background:#1d1814;color:#eadfce;">' +
    '<div style="font-family:Georgia,Times New Roman,serif;font-size:20px;line-height:26px;color:#fff;margin-bottom:8px;">Peony Studio</div>' +
    '<div style="font-size:13px;line-height:22px;color:#d8c7b2;">Torino</div>' +
    '<div style="font-size:13px;line-height:22px;margin-top:14px;">' +
    '<a href="https://www.instagram.com/peony.studio.turin/" style="color:#fff;text-decoration:underline;">Instagram</a>&nbsp;&nbsp;|&nbsp;&nbsp;' +
    '<a href="https://peonystudio.net/" style="color:#fff;text-decoration:underline;">Website</a>&nbsp;&nbsp;|&nbsp;&nbsp;' +
    '<a href="https://www.tickettailor.com/events/peonystudio1" style="color:#fff;text-decoration:underline;">Ticket Tailor</a>' +
    '</div></td></tr>';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="x-apple-disable-message-reformatting">' +
    '<meta name="color-scheme" content="light"><title>' + escapeHtml(input.workshopTitle) + " – Peony Studio</title></head>" +
    '<body style="margin:0;padding:0;background:#e9e0d3;font-family:Arial,Helvetica,sans-serif;color:#302822;">' +
    '<div style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">' +
    escapeHtml(input.preview || input.workshopTitle) + '</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#e9e0d3;">' +
    '<tr><td align="center" style="padding:18px 8px;"><table role="presentation" width="680" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:680px;background:#f8f1e6;border:1px solid #b7a998;">' +
    header + intro + input.sections.join("") + footer + "</table></td></tr></table></body></html>";
}
