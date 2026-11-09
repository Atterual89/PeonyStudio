import {describe,it,expect} from "vitest";
import {buildPeonyMemberDirectory,filterPeonyMemberDirectory} from "../peony-member-candidates";
const official={id:"book1",first_name:"Gabriele",last_name:"Vierzi",email:null,source:"official_members_book"};
const form={id:"form1",first_name:"Gabriele",last_name:"Vierzi",email:"gabriele@example.it",source:"google_sheet"};
describe("ricerca soci senza duplicati",()=>{
 it("unisce libro soci senza email e modulo Google con nome univoco",()=>{
   const rows=buildPeonyMemberDirectory([official,form],[]);
   expect(rows).toHaveLength(1);
   expect(rows[0]).toMatchObject({id:"book1",name:"Gabriele Vierzi",email:"gabriele@example.it",origin:"Libro soci + modulo"});
 });
 it("tiene separati due omonimi con email diverse",()=>{
   const rows=buildPeonyMemberDirectory([official,form,{...form,id:"form2",email:"altro@example.it"}],[]);
   expect(rows).toHaveLength(3);
   expect(rows.filter(row=>row.email)).toHaveLength(2);
 });
 it("mantiene selezionabile il profilo anagrafico anche se esiste una prova del libro",()=>{
   const rows=buildPeonyMemberDirectory([official,form],[{id:"p1",first_name:"Gabriele",last_name:"Vierzi",email:"gabriele@example.it",nickname:null}]);
   expect(rows).toHaveLength(2);
   expect(rows[0]).toMatchObject({kind:"person",id:"p1",origin:"Anagrafica"});
   expect(rows[1]).toMatchObject({kind:"member",id:"book1"});
 });
 it("email condivisa da nominativi diversi non fonde persone diverse",()=>{
   const rows=buildPeonyMemberDirectory([form,{...form,id:"form3",first_name:"Giulia",last_name:"Bianchi"}],[]);
   expect(rows).toHaveLength(2);
 });
 it("trova anche nickname e alias multipli di una scheda anagrafica",()=>{
   const rows=buildPeonyMemberDirectory([],[
     {id:"p1",first_name:"Maryna",last_name:"Rossi",nickname:"Maru",
      email:"maryna@example.it",aliases:["BlueRope","Corda Luna"]},
   ]);
   expect(filterPeonyMemberDirectory(rows,"Maru")).toMatchObject([{kind:"person",id:"p1"}]);
   expect(filterPeonyMemberDirectory(rows,"BlueRope")).toMatchObject([{kind:"person",id:"p1"}]);
   expect(filterPeonyMemberDirectory(rows,"Corda Luna")).toMatchObject([{kind:"person",id:"p1"}]);
 });
 it("ricerca per nome, cognome ed email",()=>{
   const rows=buildPeonyMemberDirectory([official,form],[]);
   expect(filterPeonyMemberDirectory(rows,"Vierzi")).toHaveLength(1);
   expect(filterPeonyMemberDirectory(rows,"gabriele@")).toHaveLength(1);
 });
});
