import { beforeEach, describe, expect, it, vi } from "vitest";

const PERSON = "11111111-1111-4111-8111-111111111111";
const PARTICIPANT = "22222222-2222-4222-8222-222222222222";

const state = vi.hoisted(() => ({
  before: {person_id:"11111111-1111-4111-8111-111111111111",match_status:"confermato",auto_created_person:false},
  after: {person_id:"11111111-1111-4111-8111-111111111111",match_status:"confermato",auto_created_person:false},
  excelIds: [] as {id:string}[],
  excelError: false,
  rpcError: null as {code:string}|null,
  refresh: vi.fn(),
}));

vi.mock("@/lib/gestionale/server/auth", () => ({
  requireOrganizer: async () => ({id:"55555555-5555-4555-8555-555555555555",role:"organizzatrice"}),
}));
vi.mock("@/lib/gestionale/server/refresh", () => ({refreshGestione:state.refresh}));
vi.mock("@/lib/gestionale/server/db", () => ({
  getGestionaleDb: () => ({
    rpc: async () => ({error:state.rpcError}),
    from: (table:string) => {
      let selection="";
      const q={
        select: (s:string) => {selection=s;return q;},
        eq: (_k:string,_v:unknown) => q,
        is: (_k:string,_v:unknown) => q,
        limit: async (_n:number) => ({data:state.excelIds,error:state.excelError?{message:"read failed"}:null}),
        maybeSingle: async () => {
          if(table==="gw_booking_participants") {
            const saved=selection==="person_id,match_status,auto_created_person";
            const p=saved?state.after:state.before;
            return {data:saved?p:{
              id:"22222222-2222-4222-8222-222222222222",
              booking_id:"44444444-4444-4444-8444-444444444444",
              workshop_id:"33333333-3333-4333-8333-333333333333",
              entered_as:"Nick",
              is_primary:true,...p,
            },error:null};
          }
          if(table==="gw_bookings")return {data:{id:"44444444-4444-4444-8444-444444444444",workshop_id:"33333333-3333-4333-8333-333333333333"},error:null};
          if(table==="gw_workshops")return {data:{id:"33333333-3333-4333-8333-333333333333"},error:null};
          return {data:null,error:null};
        },
      };
      return q;
    },
  }),
}));

import { linkOrganizerPersonAction } from "@/app/gestione/(app)/w/person-link-actions";

beforeEach(()=>{
  state.before={person_id:PERSON,match_status:"confermato",auto_created_person:false};
  state.after={person_id:PERSON,match_status:"confermato",auto_created_person:false};
  state.excelIds=[];state.excelError=false;state.rpcError=null;state.refresh.mockClear();
});

describe("Abbinamenti Ale: ricevuta verificata e stato Excel separato",()=>{
  it("il collegamento workshop esistente non viene presentato come appena salvato",async()=>{
    const result=await linkOrganizerPersonAction({participantId:PARTICIPANT,personId:PERSON});
    expect(result).toEqual({ok:true,data:{alreadyLinked:true,excelLinked:false}});
    expect(state.refresh).not.toHaveBeenCalled();
  });

  it("una nuova associazione verificata è confermata con stato Excel distinto",async()=>{
    state.before={person_id:"66666666-6666-4666-8666-666666666666",match_status:"da_abbinare",auto_created_person:true};
    state.excelIds=[{id:"77777777-7777-4777-8777-777777777777"}];
    const result=await linkOrganizerPersonAction({participantId:PARTICIPANT,personId:PERSON});
    expect(result).toEqual({ok:true,data:{alreadyLinked:false,excelLinked:true}});
    expect(state.refresh).toHaveBeenCalledOnce();
  });

  it("non dichiara successo se la RPC torna senza errore ma il DB non è stato modificato",async()=>{
    state.before={person_id:"66666666-6666-4666-8666-666666666666",match_status:"da_abbinare",auto_created_person:true};
    state.after={...state.before};
    const result=await linkOrganizerPersonAction({participantId:PARTICIPANT,personId:PERSON});
    expect(result.ok).toBe(false);
    expect(state.refresh).not.toHaveBeenCalled();
  });

  it("se la lettura Excel fallisce mantiene distinta la verifica workshop",async()=>{
    state.excelError=true;
    const result=await linkOrganizerPersonAction({participantId:PARTICIPANT,personId:PERSON});
    expect(result).toEqual({ok:true,data:{alreadyLinked:true,excelLinked:null}});
  });
});
