import { describe, expect, it } from "vitest";
import { ticketTailorHtmlText, ticketTailorWorkshopFields } from "../email/ticket-tailor-workshop";
import { workshopDetailsEmail } from "../email/workshop-details";
import { workshopEmailDefaults } from "../email/defaults";

const eventHtml=[
  "<h1>Kinbaku LuXuria Level 1</h1>",
  "<p>This is a three-day course.</p>",
  "<h2>Event summary</h2><p><strong>Language:</strong> English<br><strong>Time:</strong> 10:00 – around 17:30<br><strong>Dates:</strong> 19–21 February 2027</p>",
  "<h2>What we will work on</h2><p>Technique &amp; aesthetic foundations.</p>",
  "<h2>Prerequisites</h2><p>Previous suspension experience.</p>",
  "<h3>For riggers</h3><p>Stable Gote.</p>",
  "<h2>What to bring</h2><p>At least 12 ropes.</p><p>Comfortable clothes.</p>",
  "<h2>Photos and videos</h2><p>No recordings during demonstrations.</p>",
  "<h2>Association membership</h2><p>Membership required.</p>",
  "<h2>Contacts</h2><p>Organizer contact.</p>",
].join("\n");

const payload={
  normalized:{description:"Fallback description from Ticket Tailor",bookingUrl:"https://www.tickettailor.com/events/peonystudio1/100"},
  ticket_tailor_original:{
    description:eventHtml,
    start:{date:"2027-02-19",time:"10:00"},
    end:{date:"2027-02-21",time:"17:30"},
  },
};

describe("Kinbaku workshop email sourced from linked Ticket Tailor event",()=>{
  const workshop={displayName:"Kinbaku LuXuria Level 1 - workshop",startsOn:"2027-02-19",endsOn:"2027-02-21"} as const;

  it("reads start/end from TT original payload, not absent normalized time fields",()=>{
    const fields=ticketTailorWorkshopFields({rawPayload:payload});
    expect(fields.schedule).toContain("Daily time indicated on Ticket Tailor: 10:00 – around 17:30");
    expect(fields.schedule?.join(" ")).toContain("First day (Fri, 19 Feb 2027): event starts at 10:00");
    expect(fields.schedule?.join(" ")).toContain("Last day (Sun, 21 Feb 2027): event ends at 17:30");
    expect(fields.ticketTailor?.description).toContain("At least 12 ropes");
    expect(fields.ticketTailor?.program[0]?.text).toContain("Technique & aesthetic foundations.");
    expect(fields.ticketTailor?.whatToBring[0]?.text).toContain("Comfortable clothes.");
    expect(fields.ticketTailor?.prerequisites.map(x=>x.title)).toContain("For riggers");
    expect(fields.ticketTailor?.photoPolicy[0]?.text).toContain("No recordings");
  });
  it("creates informative sections directly from the original workshop description",()=>{
    const fields=ticketTailorWorkshopFields({rawPayload:payload});
    const data={...workshopEmailDefaults(workshop),...fields};
    const html=workshopDetailsEmail(data);
    expect(html).toContain("10:00 – around 17:30");
    expect(html).toContain("At least 12 ropes");
    expect(html).toContain("Prerequisites");
    expect(html).toContain("Stable Gote");
    expect(html).toContain("Technique &amp; aesthetic foundations");
    expect(html).toContain("Original event information on Ticket Tailor");
    expect(html).not.toContain("Membership required.");
    expect(html).not.toContain("Organizer contact.");
  });
  it("does not imply daily hours from multi-day outer event timestamps",()=>{
    const fields=ticketTailorWorkshopFields({rawPayload:{
      normalized:{description:"Workshop overview"},
      ticket_tailor_original:{
        description:"<p>Workshop overview</p>",
        start:{date:"2027-04-03",time:"10:00"},
        end:{date:"2027-04-04",time:"17:30"},
      },
    }});
    expect(fields.schedule?.join(" ")).toContain("First day");
    expect(fields.schedule?.join(" ")).toContain("Last day");
    expect(fields.schedule?.join(" ")).not.toContain("Daily time");
  });
  it("escapes potentially unsafe source HTML rather than embedding it in Gmail",()=>{
    const dirty=eventHtml+"<script>alert(1)</script><img src=x onerror=alert(1)>";
    const fields=ticketTailorWorkshopFields({rawPayload:{
      ...payload,ticket_tailor_original:{...payload.ticket_tailor_original,description:dirty},
    }});
    const html=workshopDetailsEmail({...workshopEmailDefaults(workshop),...fields});
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("onerror");
    expect(ticketTailorHtmlText(dirty)).not.toContain("alert(1)");
  });
  it("works without an optional source description or invalid URLs",()=>{
    const fields=ticketTailorWorkshopFields({rawPayload:{
      normalized:{description:"",bookingUrl:"javascript:alert(1)"},
      ticket_tailor_original:{description:"",start:{date:"2027-04-03",time:"10:00"},end:{date:"2027-04-03",time:"17:30"}},
    }});
    expect(fields.schedule?.join(" ")).toContain("Event end");
    expect(fields.ticketTailor?.eventUrl).toBeNull();
  });
});
