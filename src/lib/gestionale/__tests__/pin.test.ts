import { describe, expect, it } from "vitest";

import {
  checkNewPin,
  findByPin,
  hashPin,
  isTrivialPin,
  parsePinHash,
  verifyPin,
} from "../pin";

describe("hashPin / verifyPin", () => {
  it("salva il formato scrypt$N$r$p$salt$hash con i parametri espliciti", async () => {
    const stored = await hashPin("482915");
    const parts = stored.split("$");

    expect(parts).toHaveLength(6);
    expect(parts.slice(0, 4)).toEqual(["scrypt", "32768", "8", "1"]);

    const parsed = parsePinHash(stored);
    expect(parsed?.salt.length).toBe(16);
    expect(parsed?.hash.length).toBe(32);
  });

  it("usa un salt diverso a ogni hash", async () => {
    expect(await hashPin("482915")).not.toBe(await hashPin("482915"));
  });

  it("accetta il PIN corretto e rifiuta quello errato", async () => {
    const stored = await hashPin("482915");
    expect(await verifyPin("482915", stored)).toBe(true);
    expect(await verifyPin("482916", stored)).toBe(false);
    expect(await verifyPin("48291", stored)).toBe(false);
  });

  it("rifiuta hash malformati o con parametri fuori soglia", async () => {
    expect(await verifyPin("482915", "non-un-hash")).toBe(false);
    expect(parsePinHash("scrypt$2$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAA==")).toBeNull();
    expect(parsePinHash("bcrypt$32768$8$1$a$b")).toBeNull();
  });

  it("rifiuta di creare l'hash di un PIN non di 6 cifre", async () => {
    await expect(hashPin("12345")).rejects.toThrow();
    await expect(hashPin("12a456")).rejects.toThrow();
  });
});

describe("findByPin", () => {
  const pins = { alfa: "482915", beta: "730264", gamma: "195738" };

  async function candidates() {
    return Promise.all(
      Object.entries(pins).map(async ([value, pin]) => ({ pinHash: await hashPin(pin), value })),
    );
  }

  it("il PIN di ogni operatore porta all'operatore giusto", async () => {
    const list = await candidates();
    for (const [name, pin] of Object.entries(pins)) {
      expect((await findByPin(pin, list)).match).toBe(name);
    }
    expect((await findByPin("111222", list)).match).toBeNull();
  });

  it("confronta sempre con tutti gli hash, anche quando il primo corrisponde", async () => {
    const list = await candidates();

    const first = await findByPin(pins.alfa, list);
    const none = await findByPin("111222", list);

    expect(first.match).toBe("alfa");
    expect(first.comparisons).toBe(list.length);
    expect(none.comparisons).toBe(list.length);
  });

  it("non autentica nessuno se due operatori avessero lo stesso PIN", async () => {
    const list = [
      { pinHash: await hashPin("482915"), value: "alfa" },
      { pinHash: await hashPin("482915"), value: "beta" },
    ];
    expect((await findByPin("482915", list)).match).toBeNull();
  });
});

describe("validazione nuovo PIN (set-pin)", () => {
  it("riconosce i PIN banali", () => {
    for (const pin of ["000000", "999999", "123456", "234567", "012345", "654321", "987654", "543210"]) {
      expect(isTrivialPin(pin), pin).toBe(true);
    }
    for (const pin of ["482915", "123457", "112233", "135790"]) {
      expect(isTrivialPin(pin), pin).toBe(false);
    }
  });

  it("rifiuta PIN banali, già in uso o di formato errato; accetta gli altri", async () => {
    const others = [await hashPin("730264"), await hashPin("195738")];

    expect(await checkNewPin("123456", others)).toEqual({ ok: false, reason: "banale" });
    expect(await checkNewPin("111111", others)).toEqual({ ok: false, reason: "banale" });
    expect(await checkNewPin("730264", others)).toEqual({ ok: false, reason: "in_uso" });
    expect(await checkNewPin("12345", others)).toEqual({ ok: false, reason: "formato" });
    expect(await checkNewPin("482915", others)).toEqual({ ok: true });
  });
});
