// 4d, parte A: "Cerca nel libro soci" → collegare = completare, e la pagina
// si aggiorna subito (revalidate + refresh) dopo ogni azione. Dati inventati.

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Person } from "../types";

const refresh = vi.fn();
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh(), revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));
vi.mock("@/lib/gestionale/server/auth", () => ({ requireAdmin: async () => ({ id: "op-admin", role: "admin" }) }));

const P = "00000000-0000-4000-8000-0000000000c1";
const person: Person = {
  id: P,
  first_name: "Cladia",
  last_name: "a",
  nickname: null,
  email: null,
  instagram: "@cla",
  phone: null,
  teamartist_id: null,
  notes: "nota",
  association_member_id: null,
  membership_email: null,
  merged_into: null,
  version: 4,
  created_at: "",
  updated_at: "",
};

type Link = { memberId: string | null; email: string | null; firstName: string | null; lastName: string | null };
let link: Link | null = null;
let saved={
  membership_name_key:null as string|null,
  membership_email:null as string|null,
  association_member_id:null as string|null
};
const updatePerson = vi.fn<(...args: unknown[]) => Promise<{ ok: true; data: number }>>(async () => ({ ok: true, data: 5 }));
const setMembershipLink = vi.fn(async (_op:string,_id:string,_version:number,value:Link|null) => {
  saved={
    membership_name_key:null,
    membership_email:value?.email??null,
    association_member_id:value?.memberId??null
  };
  return {ok:true as const,data:5};
});
const setMembershipNameLink = vi.fn(async (_op:string,_id:string,_version:number,name:string|null)=>{
 saved={membership_name_key:name,membership_email:null,association_member_id:null};
 return {ok:true as const,data:5};
});
const setMembershipConfirmedBookLink = vi.fn(async (_op:string,_id:string,_version:number,name:string)=>{
 saved={membership_name_key:name,membership_email:null,association_member_id:null};
 return {ok:true as const,data:5};
});

vi.mock("@/lib/gestionale/server/data", () => ({
  getPerson: async (id: string) => (id === P ? person : null),
  getEnrolledPersonIds: async () => new Set(),
  getWorkshopView: async () => null,
  loadPeople: async () => [person],
}));
vi.mock("@/lib/gestionale/server/db", () => ({
  getGestionaleDb: () => ({
    from:()=>({
      select:()=>({
        eq:()=>({
          maybeSingle:async()=>({data:saved,error:null})
        })
      })
    })
  })
}));
vi.mock("@/lib/gestionale/server/membership", () => ({
  getMemberLink: async () => link,
  getMemberBadge: async () => ({ kind: "non_collegata" }),
  searchMembers: async () => [],
}));
vi.mock("@/lib/gestionale/server/mutations", () => ({
  updatePerson: (...args: unknown[]) => updatePerson(...args),
  setMembershipLink: (...args: unknown[]) => setMembershipLink(...args),
  setMembershipNameLink: (...args: unknown[]) => setMembershipNameLink(...args),
  setMembershipConfirmedBookLink: (...args: unknown[]) => setMembershipConfirmedBookLink(...args),
}));

const { linkMemberAction } = await import("@/app/gestione/(app)/w/actions");

beforeEach(() => {
  saved={membership_name_key:null,membership_email:null,association_member_id:null};
  for (const mock of [refresh, revalidatePath, updatePerson, setMembershipLink, setMembershipNameLink, setMembershipConfirmedBookLink]) mock.mockClear();
});

describe("collegare al libro soci", () => {
  it("socio con email: collegamento per email (il database completa i campi vuoti) e pagina aggiornata subito", async () => {
    link = { memberId: null, email: "claudia@example.test", firstName: "Claudia", lastName: "Acutis" };
    expect(await linkMemberAction({ personId: P, version: 4, memberId: "e:claudia@example.test" })).toEqual({ ok: true, data: { warning: null } });
    expect(setMembershipLink).toHaveBeenCalledWith("op-admin", P, 4, link);
    expect(revalidatePath).toHaveBeenCalledWith("/gestione", "layout");
    expect(refresh).toHaveBeenCalled();
  });

  it("socio del libro senza email: salva una chiave nominale reale, invece di riscrivere il nome", async () => {
    link = { memberId: null, email: null, firstName: "Claudia", lastName: "Acutis" };
    expect(await linkMemberAction({ personId: P, version: 4, memberId: "n:acutis claudia" })).toEqual({ ok: true, data: { warning: null } });
    expect(setMembershipLink).not.toHaveBeenCalled();
    expect(updatePerson).not.toHaveBeenCalled();
    expect(setMembershipConfirmedBookLink).toHaveBeenCalledWith("op-admin",P,4,"acutis claudia");
    expect(refresh).toHaveBeenCalled();
  });

  it("non dichiara collegata una persona se un trigger annulla il dato scritto", async () => {
    link={memberId:null,email:null,firstName:"Claudia",lastName:"Acutis"};
    // Simula il trigger reale precedente: RPC rispondeva OK ma la chiave veniva azzerata.
    setMembershipConfirmedBookLink.mockImplementationOnce(async()=>({ok:true as const,data:5}));
    const outcome=await linkMemberAction({
      personId:P,version:4,memberId:"n:acutis claudia",referenceDate:"2026-11-14"
    });
    expect(outcome.ok).toBe(false);
    if(!outcome.ok)expect(outcome.error).toContain("non è stato memorizzato");
    expect(refresh).not.toHaveBeenCalled();
  });
  it("la quota non viene verificata automaticamente e la ricerca non dipende da un badge in cache", async()=>{
    link={memberId:null,email:null,firstName:"Claudia",lastName:"Acutis"};
    expect(await linkMemberAction({
      personId:P,version:4,memberId:"n:acutis claudia",referenceDate:"2027-02-14"
    })).toEqual({ok:true,data:{warning:null}});
    expect(saved.membership_name_key).toBe("acutis claudia");
    expect((await linkMemberAction({
      personId:P,version:4,memberId:"n:acutis claudia",referenceDate:"ieri"
    })).ok).toBe(false);
  });
});
