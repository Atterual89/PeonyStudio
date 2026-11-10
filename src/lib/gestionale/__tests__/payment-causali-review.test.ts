import {describe,expect,it} from "vitest";
import {classifyPaymentNote,paymentBeneficiaryHints,proposalsFromPayment,suspiciousAllocation} from "@/lib/gestionale/payment-causale-review";
import {parsePaymentNotification} from "@/lib/gestionale/payment-email-parser";
import {paymentMailBody} from "@/lib/gestionale/gmail-message-body";
import type {AutoPaymentCandidate} from "@/lib/gestionale/payment-auto-proposals";

const person=(name:string,id:string):AutoPaymentCandidate=>({
  kind:"person",id,name,email:id+"@example.test",source:"Anagrafica",
});

describe("causali reali PayPal: quote e beneficiari distinti dal pagante",()=>{
  it("Maria Orlandi ha versato 30 € per Maria e Chiara Pusceddu",()=>{
    const note="quote associative Maria Orlandi + Chiara Pusceddu";
    expect(classifyPaymentNote(note)).toBe("membership");
    expect(paymentBeneficiaryHints(note)).toEqual(["Maria Orlandi","Chiara Pusceddu"]);
    const proposal=proposalsFromPayment("Maria Orlandi",note,
      [person("Chiara Pusceddu","chiara"),person("Riccardo Stopazzola","riccardo")],[]);
    expect(proposal.proposals.map(x=>x.id)).toEqual(["chiara"]);
  });
  it("30 € di Maria Orlandi per pratiche NON sono quote",()=>{
    for(const note of ["focus gote 19 marzo 2026 Meri","pratica Meri 9 aprile","pratica guidata 12/06 Merino"]){
      expect(classifyPaymentNote(note)).toBe("other");
      expect(proposalsFromPayment("Maria Orlandi",note,[person("Maria Orlandi","maria")],[]).proposals).toEqual([]);
      expect(suspiciousAllocation(note,"Maria Orlandi")).not.toBeNull();
    }
  });
  it("Stopazzola ha pagato per Loredana, Federica, Michela",()=>{
    expect(paymentBeneficiaryHints("Quota associativa Loredana Di Giulio")).toEqual(["Loredana Di Giulio"]);
    expect(paymentBeneficiaryHints("Quota associativa Federica")).toEqual(["Federica"]);
    expect(paymentBeneficiaryHints("Quota associativa Michela")).toEqual(["Michela"]);
    expect(suspiciousAllocation("Quota associativa Michela","Riccardo Stopazzola")).not.toBeNull();
    expect(proposalsFromPayment("Riccardo Stopazzola","Quota associativa Federica",
      [person("Federica Fantauzzi","one"),person("Federica Ierulli","two")],[]).proposals).toEqual([]);
    expect(proposalsFromPayment("Riccardo Stopazzola","Quota associativa Loredana Di Giulio",
      [person("Loredana Di Giulio","lori")],[]).proposals[0].id).toBe("lori");
  });
  it("non assume che tutti i pagamenti da 15/30 euro siano quote",()=>{
    expect(classifyPaymentNote("Rope Jam")).toBe("other");
    expect(classifyPaymentNote("Studio Fee")).toBe("other");
    expect(classifyPaymentNote("")).toBe("uncertain");
    expect(classifyPaymentNote("Membership fee payment Pascal Stampfli - Spicy Workshop")).toBe("membership");
  });
  it("cattura le causali presenti solo nell'HTML Gmail e su righe separate",()=>{
    const html="Maria Orlandi ti ha inviato 30,00 € EUR<p>Dettagli transazione</p><p>Codice transazione</p>"+
      "<p>[55H820035X041511D]</p><p>Messaggio da Maria Orlandi</p><p>quote associative Maria Orlandi + Chiara Pusceddu</p>";
    const base64=Buffer.from(html).toString("base64url");
    const plain=Buffer.from("Maria Orlandi ti ha inviato 30,00 € EUR").toString("base64url");
    const body=paymentMailBody({parts:[
      {mimeType:"text/plain",body:{data:plain}},
      {mimeType:"text/html",body:{data:base64}},
    ]});
    const parsed=parsePaymentNotification({from:"PayPal <service@paypal.com>",subject:"Hai ricevuto denaro",body});
    expect(parsed?.note).toBe("quote associative Maria Orlandi + Chiara Pusceddu");
  });
});
