import { describe, expect, it } from "vitest";
import { htmlMailToText, paymentMailBody } from "@/lib/gestionale/gmail-message-body";
import { parsePaymentNotification } from "@/lib/gestionale/payment-email-parser";

const base64 = (s:string)=>Buffer.from(s,"utf8").toString("base64url");
describe("import delle notifiche Gmail",()=>{
  it("legge Qonto anche quando Gmail fornisce soltanto HTML annidato",()=>{
    const payload={
      mimeType:"multipart/alternative",
      parts:[{mimeType:"multipart/related",parts:[
        {mimeType:"text/html",body:{data:base64(
          "<html><body><p>Hai ricevuto un bonifico</p><p>Importo: <strong>30,00 EUR</strong></p><div>Da: ROSSO ELISA</div></body></html>"
        )}}
      ]}]
    };
    const body=paymentMailBody(payload);
    const payment=parsePaymentNotification({
      from:"Qonto <notification@qonto.com>",
      subject:"Hai ricevuto un bonifico",
      body
    });
    expect(payment).toMatchObject({provider:"qonto",amountCents:3000,payerName:"ROSSO ELISA"});
  });
  it("preferisce testo semplice, senza duplicare una notifica multipart",()=>{
    const payload={
      mimeType:"multipart/alternative",
      parts:[
        {mimeType:"text/html",body:{data:base64("<p>Importo: 45,00 EUR</p>")}},
        {mimeType:"text/plain",body:{data:base64("Importo: 15,00 EUR\nDa: NOME")}}
      ]
    };
    expect(paymentMailBody(payload)).toBe("Importo: 15,00 EUR\nDa: NOME");
  });
  it("rifiuta un mittente falso anche se nel nome compare paypal.com",()=>{
    expect(parsePaymentNotification({
      from:"Servizio paypal.com <falso@example.com>",
      subject:"Hai ricevuto denaro",
      body:"Persona ti ha inviato 15,00 € EUR"
    })).toBeNull();
    expect(htmlMailToText("<p>Importo: &euro; 15,00</p>")).toContain("€");
  });
});
