import { describe,expect,it } from "vitest";
import { buildGoogleFormReviewQueue, type ReviewMember, type ReviewPerson } from "@/lib/gestionale/google-form-review";
import type { AssociationMembersSyncPreview } from "@/lib/association/members-sync";

const mk=(r:{id:string;first:string;last:string;email:string;sourceRowId:string;action:"create"|"update"|"unchanged"})=>r;
const forms=[
  mk({id:"1",first:"Maria Vittoria",last:"Marchesi",email:"mavi@example.test",sourceRowId:"58",action:"update"}),
  mk({id:"2",first:"Nuova",last:"Socia",email:"nuova@example.test",sourceRowId:"527",action:"create"}),
  mk({id:"3",first:"Doppia",last:"Riga",email:"doppia@example.test",sourceRowId:"12",action:"update"}),
];
const preview={
  previewRows:forms.map(form=>({
    first_name:form.first,last_name:form.last,email:form.email,source_row_id:form.sourceRowId,action:form.action,
  })),
  validSourceRows:forms.map(form=>({
    first_name:form.first,last_name:form.last,email:form.email,source_row_id:form.sourceRowId,source_hash:"a".repeat(64),
  })),
} as AssociationMembersSyncPreview;
const members:ReviewMember[]=[
  {id:"g1",source:"google_sheet",source_row_id:"58",first_name:"Maria Vittoria",last_name:"Marchesi",email:"mavi@example.test",membership_status:"expired"},
  {id:"m1",source:"manual_override",source_row_id:"manual:maria",first_name:"Maria",last_name:"vittoria Marchesi",email:"partner@example.test",membership_status:"verified"},
  {id:"d1",source:"google_sheet",source_row_id:"12",first_name:"Doppia",last_name:"Riga",email:"doppia@example.test",membership_status:"verified"},
  {id:"d2",source:"google_sheet",source_row_id:"12",first_name:"Doppia",last_name:"Riga",email:"doppia@example.test",membership_status:"verified"},
  {id:"m2",source:"manual_override",source_row_id:"manual:senza",first_name:"Senza",last_name:"Modulo",email:"pagata@example.test",membership_status:"verified"},
];
const people:ReviewPerson[]=[];

describe("revisione associativa per persona e non per fonte",()=>{
 it("blocca l'associazione automatica di Maria Vittoria quando la quota usa email diversa",()=>{
   const cases=buildGoogleFormReviewQueue({preview,members,people});
   const maria=cases.find(c=>c.kind==="homonym"&&c.name.includes("Marchesi"));
   expect(maria).toBeDefined();
   expect(maria?.canConfirm).toBe(false);
   expect(cases.filter(c=>c.kind==="changed"&&c.name.includes("Marchesi"))).toHaveLength(0);
 });
 it("non confonde due copie della medesima risposta con due persone",()=>{
   const cases=buildGoogleFormReviewQueue({preview,members,people});
   expect(cases.find(c=>c.id==="duplicate:12")).toMatchObject({
     kind:"duplicate",relatedRecords:2,canConfirm:false,
   });
   expect(cases.filter(c=>c.kind==="changed"&&c.sourceRowId==="12")).toHaveLength(0);
 });
 it("presenta i nuovi moduli separatamente e segnala il pagamento senza modulo",()=>{
   const cases=buildGoogleFormReviewQueue({preview,members,people});
   expect(cases.find(c=>c.id==="form:527")).toMatchObject({kind:"new",canConfirm:true});
   expect(cases.find(c=>c.id==="missing:m2")).toMatchObject({kind:"missing_form",canConfirm:false});
 });
 it("propone una scheda esistente senza crearne una nuova automaticamente",()=>{
   const cases=buildGoogleFormReviewQueue({
     preview,members,
     people:[{id:"p1",first_name:"Nuova",last_name:"Socia",nickname:null,email:"nuova@example.test",merged_into:null}],
   });
   expect(cases.find(c=>c.id==="form:527")).toMatchObject({
     kind:"new",canConfirm:false,candidates:[{id:"p1"}],
   });
 });
});
