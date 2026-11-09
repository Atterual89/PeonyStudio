import { describe, expect, it } from "vitest";
import { buildPeonyEmailHtml, defaultPeonyEmailTemplate, PEONY_EMAIL_KINDS } from "../peony-email-html";
import {
  isRopeJamEvent, peonyEmailSections, type PeonyEmailEventContext,
} from "../peony-email-context";

const workshop: PeonyEmailEventContext = {
  category: "workshop",
  startsOn: "2026-11-06",
  endsOn: "2026-11-08",
  startTime: "10:00",
  endTime: "17:30",
  description: "Bring 13 ropes and layered clothing.",
  bookingUrl: "https://www.tickettailor.com/events/peonystudio1/123",
};
const jam: PeonyEmailEventContext = {
  category: "community",
  startsOn: "2026-11-11",
  endsOn: null,
  startTime: "19:00",
  endTime: "22:30",
  description: null,
  bookingUrl: null,
};

describe("Peony modular email HTML", () => {
  it("keeps three clusters, with conditional practitioner/observer variants", () => {
    expect(PEONY_EMAIL_KINDS.map(k => k.id)).toEqual(["membership", "partner", "details"]);
    expect(isRopeJamEvent("Rope Jam novembre")).toBe(true);
  });
  it("uses a shared Peony HTML shell for previously plain messages", () => {
    const template = defaultPeonyEmailTemplate("membership", "Rope Jam", "11 novembre");
    const html = buildPeonyEmailHtml({
      kind: "membership", eventTitle: "Rope Jam", dateLabel: "11 novembre",
      template, context: jam,
    });
    expect(html).toContain("peony-logo.png");
    expect(html).toContain("peony-entrance.jpg");
    expect(html).toContain("Modulo associativo");
    expect(html).toContain("31/12/2026");
    expect(html).toContain("max-width:680px");
  });
  it("never executes event details or editable markup", () => {
    const template = { subject: "Test", body: '<script>alert("x")</script>' };
    const html = buildPeonyEmailHtml({
      kind: "details", eventTitle: "Workshop", dateLabel: "6 novembre", template,
      context: { ...workshop, description: '<img src=x onerror=alert(1)>' },
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
  });
  it("loads real TT fields and does not fabricate an absent schedule", () => {
    const html = buildPeonyEmailHtml({
      kind: "details", eventTitle: "Kinbaku Level 2+", dateLabel: "6–8 novembre",
      template: defaultPeonyEmailTemplate("details", "Kinbaku Level 2+", "6–8 novembre", "en"),
      context: workshop,
    });
    expect(html).toContain("10:00 – 17:30");
    expect(html).toContain("Bring 13 ropes");
    const noTime = peonyEmailSections({ kind: "details", eventTitle: "Kinbaku Level 2+",
      context: { ...workshop, startTime: null, endTime: null, description: null } });
    expect(noTime).not.toContain("10:00");
    expect(noTime).not.toContain("13 ropes");
  });
  it("does not request association or promise vouchers for observer emails", () => {
    const html = buildPeonyEmailHtml({
      kind: "details", audience: "observer", eventTitle: "Rope Jam",
      dateLabel: "11 novembre", template: defaultPeonyEmailTemplate("details","Rope Jam","11 novembre"),
      context: jam,
    });
    expect(html).toContain("Non è richiesta l&#39;iscrizione all&#39;associazione.");
    expect(html).toContain("non è previsto il buono corde");
    expect(html).not.toContain("saldare in loco");
    expect(html).not.toContain("I nuovi associati ricevono");
  });
  it("does not insert registration in free Aperi Bottom details", () => {
    const html = peonyEmailSections({
      kind: "details", eventTitle: "Aperi Bottom - Evento free",
      context: { ...jam, startTime: null, description: null },
    });
    expect(html).not.toContain("Quota");
    expect(html).not.toContain("associativo");
  });
  it("keeps partner email and personal membership requests separate", () => {
    const html = buildPeonyEmailHtml({
      kind: "partner", eventTitle: "Kinbaku LuXuria Level 2+",
      dateLabel: "6 novembre",
      template: defaultPeonyEmailTemplate("partner", "Kinbaku LuXuria Level 2+", "6 novembre", "en"),
      context: workshop,
    });
    expect(html).toContain("Partner information required");
    expect(html).toContain("Association form");
    expect(html).toContain("31/12/2026");
  });
});
