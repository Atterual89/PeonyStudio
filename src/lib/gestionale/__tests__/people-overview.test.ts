import {describe,expect,it} from "vitest";
import {buildPeopleOverview} from "../people-overview";
import type {Person} from "../types";
import type {SociReviewRow} from "@/lib/gestionale/server/soci";
function person(id:string,name:string,email:string):Person{
  const [first,last]=name.split(" ");
  return {id,first_name:first,last_name:last,nickname:null,email,instagram:null,phone:null,
    teamartist_id:null,notes:null,association_member_id:null,membership_email:email,
    merged_into:null,version:1,created_at:"",updated_at:""};
}
function form(id:string,name:string,email:string,paid=false):SociReviewRow{
  return {key:id,formMemberId:id,name,email,submittedAt:null,personId:null,
    paid,paidSource:paid?"manual":null};
}
const today="2026-11-07";
const peony=[{
  key:"peony:p1",title:"Foundation 2",startsOn:"2026-11-10",endsOn:"2026-12-01",href:"/gestione/peony/p1",
  bookings:[{
    ticketId:"t1",name:"Anna Rossi",email:"a@test.it",linkedPersonId:"A",
    associationRequired:true,association:{status:"valid" as const},
    partnerRequired:true,partner:{name:"Carlo Bianchi",email:"c@test.it",linkedPersonId:null,
      memberRowId:null,membership:{status:"payment_missing" as const}},
  },{
    ticketId:"t2",name:"Giulia Blu",email:"g@test.it",linkedPersonId:null,
    associationRequired:true,association:{status:"missing_form" as const},partnerRequired:true,partner:null,
  }],
}];
describe("Persone: il gruppo è di prenotazioni, non di nomi appiattiti",()=>{
  const people=[person("A","Anna Rossi","a@test.it"),person("B","Bruno Verdi","b@test.it")];
  const forms=[form("F1","Anna Rossi","a@test.it",true),form("F2","Carlo Bianchi","c@test.it"),
    form("F3","Mai Venuta","x@test.it")];
  const base=()=>buildPeopleOverview({people,currentForms:forms,formsByYear:new Map([["2026",forms]]),peony,luxuria:[],today});
  it("mantiene due biglietti con il rispettivo partner e senza duplicare il contatto",()=>{
    const result=base();
    expect(result.upcoming[0].bookings).toHaveLength(2);
    expect(result.upcoming[0].bookings[0]).toMatchObject({
      primary:{name:"Anna Rossi",personId:"A",status:"valid"},
      partner:{name:"Carlo Bianchi",status:"payment_missing"},
    });
    expect(result.upcoming[0].bookings[1]).toMatchObject({primary:{name:"Giulia Blu"},partner:null,partnerRequired:true});
    expect(result.otherPeople.map(row=>row.personId)).toEqual(["B"]);
    expect(result.formOnly.map(row=>row.formMemberId)).toEqual(["F3"]);
  });
  it("lo stato verificato del libro resta verificato anche senza modulo Google",()=>{
    const result=buildPeopleOverview({people:[],currentForms:[],formsByYear:new Map(),peony,luxuria:[],today});
    expect(result.upcoming[0].bookings[0].primary.status).toBe("valid");
  });
  it("non abbina persone omonime che hanno email diverse",()=>{
    const only=[form("f4","Anna Rossi","altra@test.it")];
    const result=buildPeopleOverview({people:[],currentForms:only,
      formsByYear:new Map([["2026",only]]),peony,luxuria:[],today});
    expect(result.upcoming[0].bookings[0].primary.formMemberId).toBeNull();
  });
  it("nel 2027 usa la quota dell'annualità 2027 e non quella del 2026",()=>{
    const next=[form("F1","Anna Rossi","a@test.it",false)];
    const event={...peony[0],startsOn:"2027-03-10",endsOn:"2027-03-10",
      bookings:[{...peony[0].bookings[0],association:{status:"payment_missing" as const}}]};
    const result=buildPeopleOverview({people,currentForms:forms,
      formsByYear:new Map([["2026",forms],["2027",next]]),peony:[event],luxuria:[],today});
    expect(result.upcoming[0].bookings[0].primary).toMatchObject({formMemberId:"F1",paid:false,status:"payment_missing"});
  });
  it("usa la validazione LuXuria anche senza domanda Google",()=>{
    const result=buildPeopleOverview({people,currentForms:[],
      formsByYear:new Map(),peony:[],
      luxuria:[{key:"lx",title:"LuXuria",startsOn:"2026-12-01",endsOn:null,
        href:"/gestione/w/lx",bookings:[{bookingId:"b1",personIds:["A","B"],
          statuses:{"A":"valid" as const,"B":"missing_form" as const}}]}],today});
    expect(result.upcoming[0].bookings[0].primary.status).toBe("valid");
    expect(result.upcoming[0].bookings[0].partner?.status).toBe("missing_form");
  });
  it("mantiene i partecipanti LuXuria collegati alla stessa prenotazione",()=>{
    const result=buildPeopleOverview({people,currentForms:forms,
      formsByYear:new Map([["2026",forms]]),peony:[],
      luxuria:[{key:"l1",title:"LuXuria",startsOn:"2026-12-01",endsOn:null,href:"/gestione/w/w",
        bookings:[{bookingId:"b1",personIds:["A","B"]}]}],today});
    expect(result.upcoming[0].bookings).toHaveLength(1);
    expect(result.upcoming[0].bookings[0].partner?.name).toBe("Bruno Verdi");
  });
});
