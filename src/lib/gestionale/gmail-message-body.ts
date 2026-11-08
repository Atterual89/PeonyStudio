/** Testabile senza accesso Gmail: estrazione del testo da payload MIME di Gmail.
 * Le notifiche Qonto possono essere inviate soltanto come text/html.
 */
type GmailPart = {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: GmailPart[] | null;
};

const decode = (data: string) =>
  Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

export function htmlMailToText(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\s*(br\b[^>]*|\/?(?:p|div|tr|td|li|h[1-6])\b[^>]*)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/&(?:euro|#8364);/gi, "€")
    .replace(/&amp;/gi, "&")
    .replace(/&(?:lt|gt|quot|apos);/gi, " ")
    .replace(/&#(\d+);/g, (_,n:string)=>String.fromCodePoint(Number(n)))
    .replace(/[\t ]+/g, " ")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}

export function paymentMailBody(part:GmailPart|null|undefined): string {
  if(!part)return "";
  const plain:string[]=[];
  const html:string[]=[];
  function visit(node:GmailPart) {
    if(node.body?.data) {
      if(node.mimeType==="text/plain")plain.push(decode(node.body.data));
      else if(node.mimeType==="text/html")html.push(htmlMailToText(decode(node.body.data)));
      else if(!node.parts?.length)plain.push(decode(node.body.data));
    }
    for(const child of node.parts??[])visit(child);
  }
  visit(part);
  return plain.filter(Boolean).join("\n") || html.filter(Boolean).join("\n");
}
