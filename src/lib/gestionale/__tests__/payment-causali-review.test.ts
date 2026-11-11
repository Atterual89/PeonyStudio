import {describe,expect,it} from "vitest";
import {classifyPaymentNote,paymentBeneficiaryHints,proposalsFromPayment,suspiciousAllocation} from "@/lib/gestionale/payment-causale-review";
import {parsePaymentNotification} from "@/lib/gestionale/payment-email-parser";
import {paymentMailBody} from "@/lib/gestionale/gmail-message-body";
import type {AutoPaymentCandidate} from "@/lib/gestionale/payment-auto-proposals";

const person=(name:string,id:string):AutoPaymentCandidate=>({
  kind:"person",id,name,email:id+"@example.test",source:"Anagrafica",
});

describe("causali reali PayPal: quote e beneficiari distinti dal pagante",()=>{
  it("Viola Ferraresi ha versato 30 € per Viola e Irene Saltarelli",()=>{
    const note="quote associative Viola Ferraresi + Irene Saltarelli";
    expect(classifyPaymentNote(note)).toBe("membership");
    expect(paymentBeneficiaryHints(note)).toEqual(["Viola Ferraresi","Irene Saltarelli"]);
    const proposal=proposalsFromPayment("Viola Ferraresi",note,
      [person("Irene Saltarelli","irene"),person("Tommaso Ravizza","tommaso")],[]);
    expect(proposal.proposals.map(x=>x.id)).toEqual(["irene"]);
  });
  it("30 € di Viola Ferraresi per pratiche NON sono quote",()=>{
    for(const note of ["focus gote 19 marzo 2026 Vio","pratica Vio 9 aprile","pratica guidata 12/06 Violetta"]){
      expect(classifyPaymentNote(note)).toBe("other");
      expect(proposalsFromPayment("Viola Ferraresi",note,[person("Viola Ferraresi","viola")],[]).proposals).toEqual([]);
      expect(suspiciousAllocation(note,"Viola Ferraresi")).not.toBeNull();
    }
  });
  it("Ravizza ha pagato per Nadia, Giorgia, Elisa",()=>{
    expect(paymentBeneficiaryHints("Quota associativa Nadia De Santis")).toEqual(["Nadia De Santis"]);
    expect(paymentBeneficiaryHints("Quota associativa Giorgia")).toEqual(["Giorgia"]);
    expect(paymentBeneficiaryHints("Quota associativa Elisa")).toEqual(["Elisa"]);
    expect(suspiciousAllocation("Quota associativa Elisa","Tommaso Ravizza")).not.toBeNull();
    expect(proposalsFromPayment("Tommaso Ravizza","Quota associativa Giorgia",
      [person("Giorgia Pellacani","one"),person("Giorgia Brunetto","two")],[]).proposals).toEqual([]);
    expect(proposalsFromPayment("Tommaso Ravizza","Quota associativa Nadia De Santis",
      [person("Nadia De Santis","nadia")],[]).proposals[0].id).toBe("nadia");
  });
  it("non assume che tutti i pagamenti da 15/30 euro siano quote",()=>{
    expect(classifyPaymentNote("Rope Jam")).toBe("other");
    expect(classifyPaymentNote("Studio Fee")).toBe("other");
    expect(classifyPaymentNote("")).toBe("uncertain");
    expect(classifyPaymentNote("Membership fee payment Jonas Brettner - Spicy Workshop")).toBe("membership");
  });
  it("cattura le causali presenti solo nell'HTML Gmail e su righe separate",()=>{
    const html="Viola Ferraresi ti ha inviato 30,00 € EUR<p>Dettagli transazione</p><p>Codice transazione</p>"+
      "<p>[1AB23456CD789012E]</p><p>Messaggio da Viola Ferraresi</p><p>quote associative Viola Ferraresi + Irene Saltarelli</p>";
    const base64=Buffer.from(html).toString("base64url");
    const plain=Buffer.from("Viola Ferraresi ti ha inviato 30,00 € EUR").toString("base64url");
    const body=paymentMailBody({parts:[
      {mimeType:"text/plain",body:{data:plain}},
      {mimeType:"text/html",body:{data:base64}},
    ]});
    const parsed=parsePaymentNotification({from:"PayPal <service@paypal.com>",subject:"Hai ricevuto denaro",body});
    expect(parsed?.note).toBe("quote associative Viola Ferraresi + Irene Saltarelli");
  });
});
