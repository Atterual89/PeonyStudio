import { describe, expect, it } from "vitest";
import { escapeHtml, peonyEmailLayout } from "../email/layout";
import { membershipRequestEmail } from "../email/membership-request";
import { partnerUnknownEmail } from "../email/partner-unknown";
import { membershipReminderEmail, partnerReminderEmail } from "../email/reminder";
import { workshopDetailsEmail } from "../email/workshop-details";
import type { WorkshopEmailData } from "../email/types";

const base: WorkshopEmailData = {
  title: "Kinbaku LuXuria Level 2+",
  dateLabel: "6–8 November 2026",
  location: "Via Vandalino 85/38, Turin, Italy",
  intercom: "UR EXPRESSION",
  mapsUrl: "https://www.google.com/maps/search/Via+Vandalino+85",
  membershipFormUrl: "https://forms.gle/bgc9cx2c79rYayXj8",
  membershipFeeEuro: 15,
  membershipDeadline: "4 November 2026, 10:00",
  program: ["Variations", "More transitions"],
  prerequisitesRiggers: ["Prior rope knowledge"],
  ropes: "12 jute ropes",
};

describe("Peony email HTML — shared design", () => {
  it("uses the same colors, width and typography as the reference", () => {
    const html = peonyEmailLayout({ workshopTitle: base.title, dateLabel: base.dateLabel, intro: "", sections: [] });
    expect(html).toContain("max-width:680px");
    expect(html).toContain("#8f2635");
    expect(html).not.toContain("data:image/");
    expect(html).toContain("Georgia");
    expect(html).toContain("https://peonystudio.net/email/peony-logo.png");
    expect(html).not.toContain("data:image/");
  });
  it("escapes user-supplied text instead of interpreting HTML", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    const html = workshopDetailsEmail({ ...base, intro: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("four HTML message types", () => {
  it("association request shows partner section only when partner is unknown", () => {
    const missing = membershipRequestEmail({ ...base, partnerStatus: "unknown", coupleBooking: true });
    const known = membershipRequestEmail({ ...base, partnerStatus: "registered", coupleBooking: true });
    expect(missing).toContain("Provide details of your partner");
    expect(missing).toContain("€30");
    expect(known).not.toContain("Provide details of your partner");
    expect(known).toContain("Dear,");
    expect(missing).not.toContain("data:image/");
  });
  it("partner message uses provided membership dates and highlights requested action", () => {
    const html = partnerUnknownEmail({ ...base, membershipExpiresOn: "31 December 2026", nextMembershipExpiresOn: "31 December 2027" });
    expect(html).toContain("31 December 2026");
    expect(html).toContain("31 December 2027");
    expect(html).toContain("◆ IMPORTANT");
    expect(html).toContain("Association registration form");
  });
  it("reminders retain the same HTML and add the deadline", () => {
    const membership = membershipReminderEmail({ ...base, partnerStatus: "unknown", coupleBooking: true });
    const partner = partnerReminderEmail({ ...base, membershipExpiresOn: "31 December 2026", nextMembershipExpiresOn: "31 December 2027" });
    expect(membership).toContain("We haven&#39;t received your registration yet.");
    expect(partner).toContain("We still don&#39;t know who your partner will be.");
    expect(membership).toContain(base.membershipDeadline);
  });
  it("workshop details omits empty optional sections", () => {
    const html = workshopDetailsEmail({ ...base, prerequisitesModels: [], extraNotes: "" });
    expect(html).toContain("What we will work on");
    expect(html).toContain("12 jute ropes");
    expect(html).not.toContain("Additional information");
    expect(html).toContain("https://peonystudio.net/email/peony-entrance.jpg");
  });
});
