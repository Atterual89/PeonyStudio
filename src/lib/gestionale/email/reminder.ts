import { emailBox, emailParagraph } from "./layout";
import { membershipRequestEmail, type MembershipRequestInput } from "./membership-request";
import { partnerUnknownEmail, type PartnerUnknownInput } from "./partner-unknown";
import { workshopDetailsEmail } from "./workshop-details";
import type { WorkshopEmailData } from "./types";

/** Compose the corresponding real email body with an unmistakable reminder notice. */
function insertReminder(html: string, notice: string, deadline: string): string {
  const panel = emailBox("Reminder — action needed", emailParagraph(notice) + emailParagraph("Deadline: " + deadline));
  const index = html.indexOf("<!-- PEONY REMINDER INSERT -->");
  if (index >= 0) return html.replace("<!-- PEONY REMINDER INSERT -->", panel);
  // Place the reminder prominently after the header, before the opening paragraph.
  const intro = '<tr><td style="padding:34px 38px 8px;font-size:16px;line-height:1.75;">';
  return html.replace(intro, panel + intro);
}

export function membershipReminderEmail(input: MembershipRequestInput): string {
  return insertReminder(membershipRequestEmail(input), "We haven't received your registration yet.", input.membershipDeadline);
}
export function partnerReminderEmail(input: PartnerUnknownInput): string {
  return insertReminder(partnerUnknownEmail(input), "We still don't know who your partner will be.", input.membershipDeadline);
}

/** Explicit reminder of workshop logistics, after the first details email was sent. */
export function workshopDetailsReminderEmail(input: WorkshopEmailData): string {
  return insertReminder(workshopDetailsEmail(input),
    "This is a reminder of the practical information for your workshop. Please check the details below.",
    input.dateLabel);
}
