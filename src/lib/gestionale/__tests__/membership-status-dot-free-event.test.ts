import { describe,expect,it } from "vitest";
import { readFileSync } from "node:fs";
import { isMembershipFreePeonyEvent,peonyAssociationRequired } from "@/lib/gestionale/peony-ticket-rules";

const file=(path:string)=>readFileSync(path,"utf8");

describe("Aperi-Bottom Free: tessera non obbligatoria per tutte le persone",()=>{
  it("riconosce i titoli pubblicati e variazioni tipografiche",()=>{
    for(const title of [
      "Aperi-Bottom - evento free","Aperi Bottom - Free",
      "Aperibottom - evento FREE","APERI_BOTTOM - Free",
    ]) expect(isMembershipFreePeonyEvent(title)).toBe(true);
  });
  it("non esenta workshop diversi o Aperi-Bottom non dichiarati free",()=>{
    for(const title of [
      "Aperi-Bottom","Rope Jam","Foundation Level 1",
      "Body Handling Free","Aperi-Bottom - evento a pagamento",
    ]) expect(isMembershipFreePeonyEvent(title)).toBe(false);
  });
  it("un praticante in un evento free ha la stessa esenzione dell'observer",()=>{
    expect(peonyAssociationRequired("Aperi-Bottom - evento free","practitioner")).toBe(false);
    expect(peonyAssociationRequired("Aperi-Bottom - evento free","observer")).toBe(false);
    expect(peonyAssociationRequired("Aperi-Bottom - evento free","unknown")).toBe(false);
    expect(peonyAssociationRequired("Rope Jam","observer")).toBe(false);
    expect(peonyAssociationRequired("Rope Jam","practitioner")).toBe(true);
    expect(peonyAssociationRequired("Foundation Level 1","practitioner")).toBe(true);
  });
  it("non cambia lo stato della quota nel database, solo la regola per l'evento",()=>{
    const loader=file("src/lib/gestionale/server/peony-events.ts");
    expect(loader).toContain("const freeEvent=isMembershipFreePeonyEvent(event.title)");
    expect(loader).toContain("const membershipRequired=peonyAssociationRequired(event.title,ticketRole)");
    expect(loader).toContain("association: associationStatus(evidence, event, identity)");
    expect(loader).toContain("associationRequired: membershipRequired");
    const operations=file("src/components/gestionale/PeonyEventOperations.tsx");
    expect(operations).toContain('person.freeEvent?"Ingresso libero"');
    expect(operations).toContain("peonyStatus(person.association,person.associationRequired)");
    expect(operations).toContain("person.associationRequired &&");
    expect(operations).toContain('if(info?.status==="valid")return "verified";');
    expect(operations).toContain('if(!required)return "not_required";');
    expect(operations).toContain("peonyStatus(person.partner.membership,person.associationRequired)");
  });
});

describe("una legenda coerente nel gestionale, nessuna etichetta ripetuta in elenco",()=>{
  it("riserva 4 stati distinti, con testo accessibile per i lettori di schermo",()=>{
    const dot=file("src/components/gestionale/AssociationStatusDot.tsx");
    for(const x of ["verified","payment_missing","missing_form","not_required"]){
      expect(dot).toContain(x);
    }
    expect(dot).toContain("role=\"img\" aria-label={info.label} title={info.label}");
    expect(dot).toContain("Tessera associativa non richiesta");
  });
  it("mette il pallino prima del nome nei principali elenchi",()=>{
    const files=[
      "src/components/gestionale/PeonyEventOperations.tsx",
      "src/components/gestionale/ParticipantsTab.tsx",
      "src/components/gestionale/UnifiedPeopleDirectory.tsx",
      "src/components/gestionale/BookingDetails.tsx",
      "src/components/gestionale/PeonyPartnerFinder.tsx",
    ];
    for(const path of files){
      const source=file(path);
      expect(source).toMatch(/(AssociationStatusDot|MembershipBadge)/);
    }
    expect(file(files[1])).toContain("<MembershipBadge badge={entry.membership} compact />");
    expect(file(files[2])).toContain("<AssociationStatusDot status={directoryDot[contact.association]}/>");
    expect(file(files[3])).toContain("<MembershipBadge badge={badge} compact />");
  });
});
