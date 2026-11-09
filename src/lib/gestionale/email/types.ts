export type WorkshopEmailData = {
  title: string;
  dateLabel: string;
  location: string;
  intercom: string;
  mapsUrl: string;
  membershipFormUrl: string;
  membershipFeeEuro: number;
  membershipDeadline: string;
  intro?: string;
  program?: string[];
  prerequisitesRiggers?: string[];
  prerequisitesModels?: string[];
  ropes?: string;
  clothing?: string;
  partnerPolicy?: string;
  schedule?: string[];
  arrival?: string;
  extraNotes?: string;
  signature?: string;
  accessInfo?: string[];
  lunchInfo?: string[];
  venueRules?: string[];
  photoPolicy?: string[];
  emergencyContact?: string;
  associationName?: string;
  associationPresident?: string;
  associationVicePresident?: string;
  transferInstructions?: string;
  lunchMapUrl?: string;
};

/** D30: content specific to a single workshop vs shared defaults. */
export const WORKSHOP_EMAIL_KEYS = [
  "title","dateLabel","membershipDeadline","intro","schedule","arrival",
  "program","prerequisitesRiggers","prerequisitesModels","ropes","clothing","partnerPolicy","extraNotes",
] as const satisfies readonly (keyof WorkshopEmailData)[];
export const GLOBAL_EMAIL_KEYS = [
  "location","intercom","mapsUrl","membershipFormUrl","membershipFeeEuro","signature",
  "associationName","associationPresident","associationVicePresident","transferInstructions",
  "lunchMapUrl","accessInfo","lunchInfo","venueRules","photoPolicy","emergencyContact",
] as const satisfies readonly (keyof WorkshopEmailData)[];
