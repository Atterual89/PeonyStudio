import { emailBox, emailButton, emailParagraph, emailSection, peonyEmailLayout } from "./layout";
import type { WorkshopEmailData } from "./types";

export type MembershipRequestInput = WorkshopEmailData & {
  partnerStatus: "unknown" | "not_registered" | "registered";
  partnerName?: string;
  coupleBooking: boolean;
};

export function membershipRequestEmail(input: MembershipRequestInput): string {
  const fee = input.membershipFeeEuro;
  const introduction = emailParagraph("You are receiving this email because you are going to take part in " + input.title + " at Peony Studio.") +
    emailParagraph("To take part in the workshop, everyone must be a registered member of " + (input.associationName || "UR Expression APS") + ", the cultural association of Peony Studio, represented by " + (input.associationPresident || "Andrea") + " (President) and " + (input.associationVicePresident || "Shiawase") + " (Vice-President).");
  const membership = emailParagraph("If you have never registered before, please complete the association form. After submitting it, you will receive the instructions for paying the membership fee of €" + fee + ".") +
    emailButton("Register to the association", input.membershipFormUrl);
  const partner = input.partnerStatus === "unknown"
    ? emailSection("2. Provide details of your partner",
        emailParagraph("Your partner needs to be registered too. Please forward this email to your partner, or reply with their email address so we can contact them.") +
        emailParagraph("In both cases, please reply telling us your partner's name, so we can match the registrations."))
    : input.partnerStatus === "not_registered"
      ? emailBox("Your partner also needs to be registered", emailParagraph((input.partnerName || "Your partner") + " also needs to register with the association."))
      : "";
  const transfer = (input.coupleBooking || input.partnerStatus === "unknown")
    ? emailParagraph("You can pay both membership fees in a single transfer (€" + (fee * 2) + "). In the payment description, please write: " + (input.transferInstructions || "Membership fee + your full names") + ".")
    : "";
  const sections = [
    emailSection("1. Register to the association", membership + transfer),
    partner,
    emailBox("IMPORTANT", emailParagraph("Please complete the registration procedure no later than " + input.membershipDeadline + " (48 hours before the workshop). We would appreciate it if you could do it as soon as possible.")),
    emailSection("Location & Schedule", emailParagraph("One week before the workshop you will receive an email with all the details.") +
      emailParagraph(input.location + ". Intercom: " + input.intercom + ".") +
      emailButton("Google Maps", input.mapsUrl)),
    emailSection("Questions?", emailParagraph("If you think you or your partner are already registered, or have any questions, please reply to this email.")),
  ];
  return peonyEmailLayout({ workshopTitle: input.title, dateLabel: input.dateLabel, intro: introduction, sections,
    preview: "Association registration details for " + input.title, signature: input.signature });
}
