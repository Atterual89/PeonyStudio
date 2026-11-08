import { describe, expect, it } from "vitest";
import { parsePaymentNotification, suggestedQuotaCount } from "@/lib/gestionale/payment-email-parser";

describe("notifiche quote associative",()=>{
 it("legge ricevute PayPal con transazione e messaggio",()=>{
  const item=parsePaymentNotification({
   from:"service@paypal.it",subject:"Hai ricevuto denaro",
   body:"Ciao UR Expression APS\n\nIlaria Cantore ti ha inviato 15,00 € EUR\n\nDettagli transazione\nCodice transazione\n[52D79134RB163184C](https://paypal.com)\nData transazione\n26 ottobre 2026\n\nImporto ricevuto\n15,00 € EUR\n\nMessaggio da Ilaria Cantore\nquota associativa",
  });
  expect(item).toEqual({provider:"paypal",payerName:"Ilaria Cantore",amountCents:1500,transactionRef:"52D79134RB163184C",note:"quota associativa"});
  expect(suggestedQuotaCount(item!)).toBe(1);
 });
 it("riconosce Qonto senza causale e non considera Stripe",()=>{
  const body="Hai ricevuto un bonifico\n\nImporto: 30,00 EUR\nDa: ROSSO ELISA\nConto: Conto principale";
  const item=parsePaymentNotification({from:"notification@qonto.com",subject:"Hai ricevuto un bonifico",body});
  expect(item?.amountCents).toBe(3000);
  expect(item?.note).toBeNull();
  expect(suggestedQuotaCount(item!)).toBe(2);
  expect(parsePaymentNotification({from:"notification@qonto.com",subject:"Hai ricevuto un bonifico",body:body.replace("ROSSO ELISA","Stripe")})).toBeNull();
 });
 it("accetta i netti PayPal come proposte, mai come conferme",()=>{
  const item={provider:"paypal" as const,amountCents:1426,transactionRef:null,payerName:"Persona",note:null};
  expect(suggestedQuotaCount(item)).toBe(1);
  expect(suggestedQuotaCount({...item,amountCents:398})).toBe(0);
  expect(suggestedQuotaCount({...item,amountCents:4500})).toBe(3);
 });
 it("ignora email che non arrivano dai fornitori",()=>{
  expect(parsePaymentNotification({from:"fake@example.com",subject:"Hai ricevuto denaro",body:"Andrea ti ha inviato 15,00 € EUR"})).toBeNull();
 });
});
