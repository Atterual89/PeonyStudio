import { emailBox, emailButton, emailParagraph, emailSection, peonyEmailLayout } from "./layout";
import type { WorkshopEmailData } from "./types";

export type PartnerUnknownInput = WorkshopEmailData & {
  membershipExpiresOn: string;
  nextMembershipExpiresOn: string;
};

export function partnerUnknownEmail(input: PartnerUnknownInput): string {
  const intro = emailParagraph("You are receiving this email because you are going to take part in " + input.title + " at Peony Studio.") +
    emailParagraph("Your membership is still valid (expiration: " + input.membershipExpiresOn + ").") +
    emailParagraph("You are attending a workshop organized by " + (input.associationName || "UR Expression APS") + ", represented by " + (input.associationPresident || "Andrea") + " (President) and " + (input.associationVicePresident || "Shiawase") + " (Vice-President).") +
    emailParagraph("We now need to know who your partner will be for the class, and whether they are already registered.");
  const sections = [
    emailSection("1. Check with your partner", emailParagraph("If your partner has already visited Peony Studio, we only need to check whether their membership is still valid.") +
      emailParagraph("If their membership needs renewal, the association fee of €" + input.membershipFeeEuro + " makes the new membership valid until " + input.nextMembershipExpiresOn + ".")),
    emailSection("2. Register to the association", emailParagraph("If your partner has never been to Peony Studio, they need to complete the form. You can forward this email to them or reply with their email address so we can contact them.") +
      emailButton("Association registration form", input.membershipFormUrl)),
    emailBox("IMPORTANT", emailParagraph("Please reply telling us your partner's name so we can match the registrations.") +
      emailParagraph("Registration must be completed by " + input.membershipDeadline + ". We recommend completing it as soon as possible.")),
    emailSection("Location & Schedule", emailParagraph("One week before the workshop you will receive all practical details.") +
      emailParagraph(input.location + ". Intercom: " + input.intercom + ".") + emailButton("Google Maps", input.mapsUrl)),
    emailSection("Questions?", emailParagraph("If you have any questions, please reply to this message.")),
  ];
  return peonyEmailLayout({ workshopTitle: input.title, dateLabel: input.dateLabel, intro, sections,
    preview: "Please tell us who your partner is", signature: input.signature });
}
