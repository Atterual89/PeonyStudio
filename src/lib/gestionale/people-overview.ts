import type { Person } from "./types";
import { displayName, normalizeText } from "./format";
import { normalizeMembershipEmail, normalizeMembershipNameKey } from "@/lib/association/membership-state";
import type { SociReviewRow } from "@/lib/gestionale/server/soci";

export type ContactStatus = "valid" | "payment_missing" | "missing_form" | null;
export type UpcomingContact = {
  key: string;
  name: string;
  email: string | null;
  personId: string | null;
  formMemberId: string | null;
  paid: boolean | null;
  paidSource: "manual" | "email" | null;
  status: ContactStatus;
  associationRequired?: boolean;
};
export type UpcomingBooking = {
  key: string;
  primary: UpcomingContact;
  partner: UpcomingContact | null;
  partnerRequired: boolean;
};
export type UpcomingPeopleGroup = {
  key: string;
  title: string;
  startsOn: string;
  endsOn: string | null;
  href: string;
  bookings: UpcomingBooking[];
};
export type OtherContact = UpcomingContact;
export type PeopleOverview = {
  upcoming: UpcomingPeopleGroup[];
  otherPeople: OtherContact[];
  formOnly: OtherContact[];
  totalOthers: number;
};

function uniqueByEmail<T>(values: readonly T[], emailOf: (row: T) => string | null | undefined) {
  const map = new Map<string, T | null>();
  for (const row of values) {
    const key = normalizeMembershipEmail(emailOf(row));
    if(!key)continue;
    map.set(key,map.has(key)?null:row);
  }
  return (email: string | null | undefined): T | null => {
    const key=normalizeMembershipEmail(email);
    return key?map.get(key)??null:null;
  };
}
function nameOf(first:string|null,last:string|null){return [first,last].filter(Boolean).join(" ").trim();}

export function buildPeopleOverview(input:{
  people: readonly Person[];
  currentForms: readonly SociReviewRow[];
  formsByYear: ReadonlyMap<string,readonly SociReviewRow[]>;
  peony: readonly {
    key:string;title:string;startsOn:string;endsOn:string|null;href:string;
    bookings:readonly {
      ticketId:string;name:string;email:string|null;linkedPersonId:string|null;
      associationRequired:boolean;
      association:{status:ContactStatus}|null;
      partnerRequired:boolean;
      partner:{name:string|null;email:string|null;linkedPersonId:string|null;
        memberRowId:string|null;membership:{status:ContactStatus}|null}|null;
    }[];
  }[];
  luxuria: readonly {
    key:string;title:string;startsOn:string;endsOn:string|null;href:string;
    bookings:readonly {bookingId:string;personIds:readonly string[];statuses?:Record<string,ContactStatus>}[];
  }[];
  today:string;
  query?:string;
}):PeopleOverview{
  const people=input.people.filter(person=>!person.merged_into);
  const byId=new Map(people.map(row=>[row.id,row]));
  const findPerson=uniqueByEmail(people,row=>row.email);
  const currentForm=uniqueByEmail(input.currentForms,row=>row.email);
  const formsFor=new Map([...input.formsByYear].map(([year,rows])=>[year,{
    byEmail:uniqueByEmail(rows,row=>row.email),
    byId:new Map(rows.map(row=>[row.formMemberId,row])),
    byName:rows,
  }] as const));
  const seenPeople=new Set<string>();
  const seenForms=new Set<string>();
  const query=normalizeText(input.query??"");
  function matches(name:string,email:string|null){return !query||normalizeText(name).includes(query)||normalizeText(email).includes(query);}

  function contact(name:string,email:string|null,personId:string|null,
    periodDate:string,key:string,explicitStatus?:ContactStatus,
    explicitMemberId?:string|null):UpcomingContact{
    const set=formsFor.get(periodDate.slice(0,4));
    const normalizedEmail=normalizeMembershipEmail(email);
    let form=set?.byEmail(email)??(explicitMemberId?set?.byId.get(explicitMemberId):null)??null;
    // Nome soltanto se esiste una sola corrispondenza e nessuna email in conflitto.
    if(!form && !normalizedEmail && set){
      const nameKey=normalizeMembershipNameKey(name,null);
      const candidates=set.byName.filter(row=>
        normalizeMembershipNameKey(row.name,null)===nameKey);
      if(candidates.length===1)form=candidates[0];
    }
    if(personId)seenPeople.add(personId);
    if(form)seenForms.add(form.formMemberId);
    const status=explicitStatus===undefined?(form?(form.paid?"valid":"payment_missing"):"missing_form"):explicitStatus;
    return {key,name,email,personId,formMemberId:form?.formMemberId??null,
      paid:form?form.paid:null,paidSource:form?.paidSource??null,status};
  }

  const peony=input.peony.map(event=>({
    ...event,
    bookings:event.bookings.map(row=>{
      const primaryId=byId.has(row.linkedPersonId??"")?row.linkedPersonId:findPerson(row.email)?.id??null;
      const primary={...contact(row.name,row.email,primaryId,event.startsOn,
        `ticket:${row.ticketId}:owner`,row.associationRequired?row.association?.status??null:null),
        associationRequired:row.associationRequired};
      let partner:UpcomingContact|null=null;
      if(row.partnerRequired && row.partner) {
        const p=row.partner;
        const partnerId=byId.has(p.linkedPersonId??"")?p.linkedPersonId:findPerson(p.email)?.id??null;
        partner=contact(p.name??p.email??"Partner da indicare",p.email,partnerId,event.startsOn,
          `ticket:${row.ticketId}:partner`,p.membership?.status??null,p.memberRowId);
      }
      return {key:`ticket:${row.ticketId}`,primary,partner,partnerRequired:row.partnerRequired};
    }),
  }));

  const luxuria=input.luxuria.map(event=>({
    ...event,
    bookings:event.bookings.flatMap(b=>{
      const persons=b.personIds.map(id=>byId.get(id)).filter((row):row is Person=>Boolean(row));
      if(!persons.length)return [];
      const [first,...rest]=persons;
      const primary=contact(displayName(first),first.email,first.id,event.startsOn,`p:${first.id}`,
        b.statuses?.[first.id]);
      const second=rest[0];
      const partner=second?contact(displayName(second),second.email,second.id,event.startsOn,`p:${second.id}`,
        b.statuses?.[second.id]):null;
      return [{key:`booking:${b.bookingId}`,primary,partner,partnerRequired:Boolean(second)}];
    }),
  }));
  const upcoming=[...peony,...luxuria].filter(event=>(event.endsOn??event.startsOn)>=input.today)
    .map(event=>({
      ...event,
      bookings:!query||normalizeText(event.title).includes(query)?event.bookings:
        event.bookings.filter(booking=>
          matches(booking.primary.name,booking.primary.email)||
          Boolean(booking.partner&&matches(booking.partner.name,booking.partner.email))),
    })).filter(event=>event.bookings.length>0)
    .sort((a,b)=>a.startsOn.localeCompare(b.startsOn)||a.title.localeCompare(b.title,"it"));
  const otherPeople=people.filter(person=>!seenPeople.has(person.id))
    .map(person=>{
      const form=currentForm(person.email);
      if(form)seenForms.add(form.formMemberId);
      return {key:`p:${person.id}`,name:displayName(person),email:person.email,personId:person.id,
        formMemberId:form?.formMemberId??null,paid:form?form.paid:null,
        paidSource:form?.paidSource??null,
        status:form?(form.paid?"valid":"payment_missing"):"missing_form" as ContactStatus};
    }).filter(row=>matches(row.name,row.email))
    .sort((a,b)=>a.name.localeCompare(b.name,"it"));
  const formOnly=input.currentForms.filter(form=>!seenForms.has(form.formMemberId)&&!findPerson(form.email))
    .map(form=>({key:`f:${form.formMemberId}`,name:form.name,email:form.email,personId:null,
      formMemberId:form.formMemberId,paid:form.paid,paidSource:form.paidSource,
      status:(form.paid?"valid":"payment_missing") as ContactStatus}))
    .filter(row=>matches(row.name,row.email))
    .sort((a,b)=>a.name.localeCompare(b.name,"it"));
  return {upcoming,otherPeople,formOnly,totalOthers:otherPeople.length+formOnly.length};
}
