import { membershipPeriodFor } from "@/lib/association/membership-periods";
import type { WorkshopView } from "../types";
import type { WorkshopEmailData } from "./types";

/** Safe generic defaults: workshop-specific syllabus is never invented. */
function englishDate(day: string): string {
  const date = new Date(day + "T12:00:00Z");
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

export function emailDateLabel(start: string, end: string | null): string {
  return end && end !== start ? englishDate(start) + " – " + englishDate(end) : englishDate(start);
}

export function emailDeadline(start: string): string {
  // Events start at local 10:00 by default. Editor allows manual correction.
  const date = new Date(start + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() - 2);
  return englishDate(date.toISOString().slice(0, 10)) + ", 10:00";
}

export function workshopEmailDefaults(workshop: Pick<WorkshopView, "displayName" | "startsOn" | "endsOn">): WorkshopEmailData {
  const title = workshop.displayName
    .replace(/^\s*(?:SOLD OUT|SOLD-OUT)\s*[-–:]\s*/i, "")
    .replace(/\s*[-–]\s*workshop\s*$/i, "").trim();
  return {
    title,
    dateLabel: emailDateLabel(workshop.startsOn, workshop.endsOn),
    location: "Via Vandalino 85/38, Torino, Italy · Floor -1",
    intercom: "UR Expression",
    mapsUrl: "https://maps.app.goo.gl/CnoZpoZmgzP3Absg9",
    membershipFormUrl: "https://forms.gle/bgc9cx2c79rYayXj8",
    membershipFeeEuro: 15,
    membershipDeadline: emailDeadline(workshop.startsOn),
    signature: "Peony Studio Staff",
    program: [],
    prerequisitesRiggers: [],
    prerequisitesModels: [],
    schedule: [],
    intro: "",
    ropes: "",
    clothing: "",
    arrival: "",
    extraNotes: "",
    accessInfo: [
      "Metro: Marche station, Via Eritrea exit; about 5 minutes on foot.",
      "Street parking is available nearby.",
      "Do not wait in a large group in front of the building.",
      "Ring the UR Expression intercom twice, then go to floor -1.",
      "Please be quiet on the stairs: the building is residential.",
    ],
    lunchInfo: [
      "Several restaurants and supermarkets are close to the studio. Check opening hours, especially on Sundays.",
      "You may use the studio kitchen (refrigerator, microwave and kettle) and bring your own food.",
    ],
    venueRules: [
      "The venue is shoes-free. Remove your shoes at the entrance.",
      "Smoking and vaping are not allowed inside.",
      "No open beverages in the workshop area; closed bottles are permitted.",
    ],
    photoPolicy: [
      "Photos may be taken during exercise demonstrations.",
      "Video and audio recording are not allowed unless teachers specify otherwise.",
      "Photos of your partner require their explicit consent; do not include other participants without their consent.",
      "Recording devices such as smart glasses are not allowed.",
    ],
    emergencyContact: "For urgent assistance on the day of the event, call Andrea at +39 320 648 6577 (WhatsApp / Telegram).",
    associationName: "UR Expression APS",
    associationPresident: "Andrea (Kurogami)",
    associationVicePresident: "Shiawase",
    transferInstructions: "Membership fee + your full names",
    lunchMapUrl: "https://www.google.com/maps/d/u/1/edit?mid=1-0Kk4XI6J6-GaER13vBTEmm2Bse3-uM&usp=sharing",
  };
}

export function emailMembershipDates(startsOn: string): { validUntil: string; renewalUntil: string } {
  const period = membershipPeriodFor(startsOn);
  const year = period ? Number(period.validUntil.slice(0, 4)) + 1 : Number(startsOn.slice(0, 4)) + 1;
  return {
    validUntil: period ? englishDate(period.validUntil) : "",
    renewalUntil: englishDate(year + "-12-31"),
  };
}
