import {
  emailBox, emailList, emailParagraph, emailSection, peonyEmailLayout, emailButton,
} from "./layout";
import type { WorkshopEmailData } from "./types";

/** Kinbaku LuXuria international workshop: full reference structure in English. */
export function workshopDetailsEmail(input: WorkshopEmailData): string {
  const intro = emailParagraph(input.intro || "We’re thrilled to welcome you to " + input.title + " at Peony Studio!") +
    emailParagraph("Please read this email until the end: it contains all the practical information you need for the workshop.");

  const ticketTailorText = input.extraNotes?.startsWith("From Ticket Tailor:") ?
    input.extraNotes.slice("From Ticket Tailor:".length).trim() : "";
  const information = (ticketTailorText ? emailParagraph(ticketTailorText) : "") +
    (input.program?.length ? emailList(input.program) : "");
  const equipment = (input.ropes ? emailParagraph("Ropes: " + input.ropes) : "") +
    (input.clothing ? emailParagraph("Attire: " + input.clothing) : "");
  const prerequisites =
    (input.prerequisitesRiggers?.length ? emailParagraph("For riggers:") + emailList(input.prerequisitesRiggers) : "") +
    (input.prerequisitesModels?.length ? emailParagraph("For models:") + emailList(input.prerequisitesModels) : "");
  const access=input.accessInfo ?? [];
  const associationDeadline=input.membershipDeadline.trim().startsWith("at least") ? "" :
    " Deadline: " + input.membershipDeadline + ".";

  const sections=[
    emailBox("Important at a glance",
      emailParagraph("Dates: " + input.dateLabel) +
      (input.arrival ? emailParagraph(input.arrival) : "")),
    emailSection("Event Schedule",emailList(input.schedule ?? [])),
    emailSection("Workshop Information",information),
    emailSection("What to Bring",equipment),
    emailBox("Prerequisites",prerequisites),
    emailSection("Location",
      emailParagraph(input.location + ". Intercom: " + input.intercom + ".") +
      emailButton("Find us on Google Maps",input.mapsUrl) +
      '<img src="https://peonystudio.net/email/peony-entrance.jpg" alt="Peony Studio entrance" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:12px;margin:18px auto 0;">'),
    emailSection("How to Access the Venue",emailList(access.slice(0,2))),
    emailBox("Important Notes for Your Arrival at Peony Studio",emailList(access.slice(2))),
    emailSection("Lunch and Facilities",emailList(input.lunchInfo ?? []) +
      (input.lunchMapUrl ? emailButton("Map of lunch spots and facilities",input.lunchMapUrl) : "")),
    emailSection("Venue Rules & Etiquette",emailList(input.venueRules ?? [])),
    emailBox("Photo / Video Policy",emailList(input.photoPolicy ?? [])),
    emailBox("Registration to the Studio Cultural Association",
      emailParagraph("All practitioners, including partners, must be members of UR Expression APS at least 48 hours before the workshop." +
        associationDeadline + " The membership fee is €" + input.membershipFeeEuro + " per person.") +
      emailButton("Association registration form",input.membershipFormUrl)),
    emailBox("Emergency Contact",input.emergencyContact ? emailParagraph(input.emergencyContact) : ""),
    emailSection("Additional Information",!ticketTailorText && input.extraNotes ? emailParagraph(input.extraNotes) : ""),
  ];
  return peonyEmailLayout({
    workshopTitle:input.title,dateLabel:input.dateLabel,intro,sections,
    preview:input.title+" – practical information",signature:input.signature,
  });
}
