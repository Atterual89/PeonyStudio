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
 it("non mostra due risultati se anagrafica e libro coincidono",()=>{
   const rows=buildPeonyMemberDirectory([official,form],[{id:"p1",first_name:"Gabriele",last_name:"Vierzi",email:"gabriele@example.it",nickname:null}]);
   expect(rows).toHaveLength(1);
 });
 it("email condivisa da nominativi diversi non fonde persone diverse",()=>{
   const rows=buildPeonyMemberDirectory([form,{...form,id:"form3",first_name:"Giulia",last_name:"Bianchi"}],[]);
   expect(rows).toHaveLength(2);
 });
 it("ricerca per nome, cognome ed email",()=>{
   const rows=buildPeonyMemberDirectory([official,form],[]);
   expect(filterPeonyMemberDirectory(rows,"Vierzi")).toHaveLength(1);
   expect(filterPeonyMemberDirectory(rows,"gabriele@")).toHaveLength(1);
 });
});
