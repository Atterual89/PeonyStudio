import {describe,it,expect} from "vitest";
import {resolveCentralPerson,type CentralPerson} from "../central-person-resolution";
const p=(id:string,first:string,last:string,email:string|null,extra:Partial<CentralPerson>={}):CentralPerson=>({
 id,first_name:first,last_name:last,nickname:null,email,association_member_id:null,membership_email:null,membership_name_key:null,...extra
});
const proof={id:"proof-1",first_name:"Christian",last_name:"Martelli",email:null};
describe("Ticket Tailor e KL -> gw_people",()=>{
 it("usa sempre il collegamento esplicito e non crea profili",()=>{
  expect(resolveCentralPerson({people:[p("p1","Franceska","Cela",null)],explicitPersonId:"p1",memberEvidence:[]}))
   .toEqual({personId:"p1",reason:"explicit"});
 });
 it("trova una scheda da un collegamento ufficiale confermato, anche se il biglietto usa un nickname",()=>{
  expect(resolveCentralPerson({people:[p("p1","Gesù","Christian",null,{membership_name_key:"christian martelli"})],
    memberRowId:"proof-1",memberEvidence:[proof],ticketName:"Gesù Christian"}))
   .toEqual({personId:"p1",reason:"confirmed_member"});
 });
 it("non collega omonimi con la stessa chiave associativa",()=>{
  const people=[p("a","A","B",null,{membership_name_key:"christian martelli"}),
   p("b","C","D",null,{membership_name_key:"christian martelli"})];
  expect(resolveCentralPerson({people,memberRowId:"proof-1",memberEvidence:[proof]})).toBeNull();
 });
 it("l'email di acquisto da sola non basta e la condivisione non collega nessuno",()=>{
  expect(resolveCentralPerson({people:[p("a","Mario","Rossi","payer@test.it")],
    memberEvidence:[],ticketEmail:"payer@test.it",ticketName:"Giulia Bianchi"})).toBeNull();
  expect(resolveCentralPerson({people:[p("a","Mario","Rossi","payer@test.it"),p("b","Mario","Rossi","payer@test.it")],
    memberEvidence:[],ticketEmail:"payer@test.it",ticketName:"Mario Rossi"})).toBeNull();
 });
 it("un nickname a una sola parola non fa coincidere due nomi diversi solo per l'email",()=>{
  expect(resolveCentralPerson({people:[p("a","Mario","Rossi","mario@test.it",{nickname:"Mario"})],
    memberEvidence:[],ticketEmail:"mario@test.it",ticketName:"Giulia"})).toBeNull();
  expect(resolveCentralPerson({people:[p("a","Mario","Rossi","mario@test.it",{nickname:"CordaRossa"})],
    memberEvidence:[],ticketEmail:"mario@test.it",ticketName:"CordaRossa"}))
    .toEqual({personId:"a",reason:"ticket_identity"});
 });
 it("il nome completo e l'email unici individuano la stessa scheda",()=>{
  expect(resolveCentralPerson({people:[p("a","Mario","Rossi","mario@test.it")],
    memberEvidence:[],ticketEmail:"mario@test.it",ticketName:"Mario Rossi"}))
   .toEqual({personId:"a",reason:"ticket_identity"});
 });
 it("il collegamento al libro che non corrisponde non usa il compratore come alternativa",()=>{
  expect(resolveCentralPerson({people:[p("a","Mario","Rossi","mario@test.it")],
    memberEvidence:[proof],memberRowId:"proof-1",ticketEmail:"mario@test.it",ticketName:"Mario Rossi"}))
   .toBeNull();
 });
 it("Peony riconosce la stessa scheda KL da tessera ufficiale univoca",()=>{
  const official={id:"official-1",first_name:"Christian",last_name:"Martelli",email:null,
    source:"official_members_book",membership_status:"verified"};
  expect(resolveCentralPerson({people:[p("p1","Gesù","Christian",null,{membership_name_key:"christian martelli"})],
    memberEvidence:[official],ticketName:"Christian Martelli",ticketEmail:"chri97@live.it"}))
    .toEqual({personId:"p1",reason:"confirmed_ticket_member"});
 });
 it("non risolve da omonimi, email incompatibili o nickname senza prova",()=>{
  const official={id:"official-1",first_name:"Christian",last_name:"Martelli",email:"official@example.com",
    source:"official_members_book",membership_status:"verified"};
  const person=p("p1","Gesù","Christian",null,{membership_name_key:"christian martelli"});
  expect(resolveCentralPerson({people:[person],memberEvidence:[official],
    ticketName:"Christian Martelli",ticketEmail:"other@example.com"})).toBeNull();
  expect(resolveCentralPerson({people:[person],memberEvidence:[official],
    ticketName:"Gesù Christian",ticketEmail:"official@example.com"})).toBeNull();
  expect(resolveCentralPerson({people:[person,p("p2","Altro","Nome",null,{membership_name_key:"christian martelli"})],
    memberEvidence:[official],ticketName:"Christian Martelli",ticketEmail:"official@example.com"})).toBeNull();
  expect(resolveCentralPerson({people:[person],memberEvidence:[official,{...official,id:"official-2"}],
    ticketName:"Christian Martelli",ticketEmail:"official@example.com"})).toBeNull();
 });

});
