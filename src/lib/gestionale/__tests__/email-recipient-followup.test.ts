import { describe, expect, it } from "vitest";
import { emailRecipients } from "../email/recipients";
import type { BookingView } from "../types";
import type { EmailSendRow } from "../server/email";

const person={
  person: {id:"person-a",email:"example@peony.test",merged_into:null,nickname:"Test"},
  displayName:"Test",fullName:"Test",
  isPrimary:true,
  membership:{kind:"in_regola"},
  contacts:[],
};
const bookings=[{status:"saldato",people:[person]}] as unknown as BookingView[];

describe("Email: never repeat the first send by default",()=>{
  it("moves workshop details to a separate reminder after the initial send",()=>{
    const initial=emailRecipients(bookings,[]);
    expect(initial.some(row=>row.type==="workshop_details")).toBe(true);
    expect(initial.some(row=>row.type==="workshop_details_reminder")).toBe(false);
    const previous:EmailSendRow[]=[{
      id:"send-1",personId:"person-a",kind:"workshop_details",number:0,sentOn:"2026-11-01",
    }];
    const after=emailRecipients(bookings,previous);
    expect(after.some(row=>row.type==="workshop_details")).toBe(false);
    expect(after.some(row=>row.type==="workshop_details_reminder")).toBe(true);
  });
  it("keeps reminder candidates after multiple follow-ups without re-offering first send",()=>{
    const prior:EmailSendRow[]=[0,1,2].map(number=>({
      id:"send-"+number,personId:"person-a",kind:"workshop_details" as const,
      number,sentOn:"2026-11-01",
    }));
    const after=emailRecipients(bookings,prior);
    expect(after.filter(row=>row.type==="workshop_details")).toHaveLength(0);
    expect(after.filter(row=>row.type==="workshop_details_reminder")).toHaveLength(1);
  });
});
