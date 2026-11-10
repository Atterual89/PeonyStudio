import { describe, expect, it } from "vitest";
import { buildPeonyEmailHtml, defaultPeonyEmailTemplate, PEONY_EMAIL_KINDS } from "../peony-email-html";
import { peonyEmailLanguage, type PeonyEmailEventContext } from "../peony-email-context";
import { peonyInformativeSections } from "../peony-email-details";

const workshop: PeonyEmailEventContext = {
  category:"workshop",startsOn:"2026-11-06",endsOn:"2026-11-08",
  startTime:"10:00",endTime:"17:30",description:"Day 1: technique.\nDay 2: transitions.",
  bookingUrl:"https://www.tickettailor.com/events/peonystudio1/123",
};
const jam: PeonyEmailEventContext = {
  category:"community",startsOn:"2026-11-11",endsOn:null,
  startTime:"19:00",endTime:"22:30",description:null,bookingUrl:null,
};

describe("Peony reference email layout",()=>{
  it("defaults international workshops to English and Rope Jam to Italian",()=>{
    expect(PEONY_EMAIL_KINDS.map(k=>k.id)).toEqual(["membership","partner","details"]);
    expect(peonyEmailLanguage("Neck Rope Workshop",workshop)).toBe("en");
    expect(peonyEmailLanguage("Rope Jam",jam)).toBe("it");
  });
  it("follows the supplied workshop section order and retains useful details",()=>{
    const html=buildPeonyEmailHtml({
      kind:"details",eventTitle:"Neck Rope by Soptik & Sansei",dateLabel:"10–11 October 2026",
      template:defaultPeonyEmailTemplate("details","Neck Rope","10 October","en"),
      language:"en",context:workshop,
      detailFields:{doorsOpen:"09:30",dailyStart:"10:00",dailyEnd:"17:30",
        lunchBreak:"1 hour",ropes:"At least 9 ropes",clothing:"Session-appropriate",
        prerequisites:"Completed Level 1",riggersPrerequisites:"Gote",
        modelsPrerequisites:"Suspension experience"},
    });
    const labels=["Important at a glance","Event Schedule","Workshop Information",
      "What to Bring","Prerequisites","Location","How to Access the Venue",
      "Important Notes for Your Arrival at Peony Studio","Lunch and Facilities",
      "Venue Rules &amp; Etiquette","Photo / Video Policy",
      "Registration to the Studio Cultural Association","Emergency Contact"];
    let previous=-1;
    for(const label of labels){
      const index=html.indexOf(label,previous+1);
      expect(index,label+" missing or out of order").toBeGreaterThan(previous);
      previous=index;
    }
    expect(html).toContain("At least 9 ropes");
    expect(html).toContain("Day 1: technique.");
    expect(html).toContain('lang="en"');
  });
  it("does not infer daily schedules from a multi-day Ticket Tailor event",()=>{
    const html=peonyInformativeSections({
      eventTitle:"International Workshop",dateLabel:"6–8 November 2026",
      context:workshop,language:"en",
    });
    expect(html).toContain("Ticket Tailor event start");
    expect(html).not.toContain("Doors Open:");
    expect(html).not.toContain("Lunch break:");
    expect(html).toContain("Day 1: technique.");
  });
  it("escapes HTML from TT descriptions and editor fields",()=>{
    const html=buildPeonyEmailHtml({
      kind:"details",eventTitle:"International Workshop",dateLabel:"6 November",
      template:{subject:"Test",body:'<script>alert("x")</script>'},
      context:{...workshop,description:'<img src=x onerror=alert(1)>'},
      detailFields:{program:'<svg onload=alert(1)>'},
    });
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;svg");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
  });
  it("uses the Italian Rope Jam order, including last entry and association",()=>{
    const html=peonyInformativeSections({
      eventTitle:"Rope Jam",dateLabel:"11 novembre 2026",
      context:jam,language:"it",fields:{lastEntry:"21:30"},
    });
    const labels=["Prima volta a Peony Studio?","Programma della serata",
      "Peony Studio","Come accedere allo studio","Regole dello spazio &amp; etichetta",
      "Associazione","Contatto di emergenza"];
    let previous=-1;
    for(const label of labels){
      const index=html.indexOf(label,previous+1);
      expect(index,label+" missing or out of order").toBeGreaterThan(previous);
      previous=index;
    }
    expect(html).toContain("21:30");
    expect(html).toContain("10 €");
    expect(html).toContain("vademecum");
  });
  it("does not ask observers for membership or another payment",()=>{
    const html=peonyInformativeSections({
      eventTitle:"Rope Jam",dateLabel:"11 novembre",context:jam,
      language:"it",audience:"observer",
    });
    expect(html).toContain("Come observer, ricordati che");
    expect(html).toContain("non è previsto il buono corde");
    expect(html).toContain("L&#39;ingresso come observer è possibile una sola volta");
    expect(html).not.toContain("I nuovi associati ricevono");
    expect(html).not.toContain("saldare in loco");
  });
  it("does not require association for a free event",()=>{
    const html=peonyInformativeSections({
      eventTitle:"Aperi Bottom - Evento free",dateLabel:"13 dicembre 2026",
      language:"it",context:jam,
    });
    expect(html).not.toContain("Modulo associativo");
    expect(html).not.toContain("I nuovi associati ricevono");
  });
  it("keeps the branded HTML for association and partner communications",()=>{
    const html=buildPeonyEmailHtml({
      kind:"membership",eventTitle:"Kinbaku LuXuria Level 2+",
      dateLabel:"6 novembre",template:defaultPeonyEmailTemplate("membership","KL","6 novembre","en"),
      context:workshop,
    });
    expect(html).toContain("peony-logo.png");
    expect(html).toContain("peony-entrance.jpg");
    expect(html).toContain("Association registration");
    expect(html).toContain("31/12/2027");
    expect(html).toContain("max-width:680px");
  });
});
