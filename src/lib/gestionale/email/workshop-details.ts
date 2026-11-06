import { emailBox, emailList, emailParagraph, emailSection, peonyEmailLayout, emailButton } from "./layout";
import type { WorkshopEmailData } from "./types";

/** Empty optional sections are omitted. No HTML from workshop fields is interpolated unescaped. */
export function workshopDetailsEmail(input: WorkshopEmailData): string {
  const intro = emailParagraph(input.intro || "We're thrilled to welcome you to " + input.title + " at Peony Studio!") +
    emailParagraph("Please read this email until the end: it contains important workshop information.");
  const schedule = [...(input.schedule || []), ...(input.arrival ? [input.arrival] : [])];
  const prerequisites = (input.prerequisitesRiggers?.length ? emailParagraph("For riggers:") + emailList(input.prerequisitesRiggers) : "") +
    (input.prerequisitesModels?.length ? emailParagraph("For models:") + emailList(input.prerequisitesModels) : "");
  const sections = [
    emailBox("Important at a glance", emailParagraph("Dates: " + input.dateLabel) +
      (input.arrival ? emailParagraph(input.arrival) : "")),
    emailSection("Event Schedule", emailList(schedule)),
    emailSection("What we will work on", emailList(input.program || [])),
    emailBox("Prerequisites", prerequisites),
    emailSection("What to bring",
      (input.ropes ? emailParagraph("Ropes: " + input.ropes) : "") +
      (input.clothing ? emailParagraph("Clothing: " + input.clothing) : "")),
    emailSection("Location & Arrival", emailParagraph(input.location + ". Intercom: " + input.intercom + ".") +
      emailButton("Google Maps", input.mapsUrl) +
      '<img src="https://peonystudio.net/email/peony-entrance.jpg" alt="Peony Studio entrance" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:12px;margin:18px auto 0;">'),
    emailSection("Additional information", input.extraNotes ? emailParagraph(input.extraNotes) : ""),
  ];
  return peonyEmailLayout({ workshopTitle: input.title, dateLabel: input.dateLabel, intro, sections,
    preview: input.title + " – practical information", signature: input.signature });
}
