import { describe, expect, it } from "vitest";
import { buildPeonyEmailHtml, defaultPeonyEmailTemplate, PEONY_EMAIL_KINDS } from "../peony-email-html";
describe("tre email HTML Peony", () => {
  it("prevede tutte le tre comunicazioni", () => {
    expect(PEONY_EMAIL_KINDS.map(k => k.id)).toEqual(["membership","partner","details"]);
  });
  it("mostra il logo, il modulo e non esegue HTML inserito nei campi", () => {
    const template={subject:"Test",body:'Ciao <script>alert("x")</script>'};
    const html=buildPeonyEmailHtml({kind:"membership",eventTitle:"Corso",dateLabel:"10 nov",template});
    expect(html).toContain("peony-logo.png");
    expect(html).toContain("forms.gle");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
  it("non inventa orari del workshop", () => {
    expect(defaultPeonyEmailTemplate("details", "Foundation Lv.2","10 novembre").body).toContain("[Inserisci qui");
  });
});
