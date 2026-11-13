import { describe, expect, it } from "vitest";

import { paymentStepCounts, stepState, type PaymentForCount } from "@/lib/gestionale/verifiche-steps";

const p = (over: Partial<PaymentForCount>): PaymentForCount =>
  ({ status: "pending", slots: [], availableSlots: 1, formCheck: "found", ...over });

describe("paymentStepCounts", () => {
  it("separa le quote da assegnare da quelle che aspettano il modulo", () => {
    expect(paymentStepCounts([
      p({}), p({ formCheck: "review" }), p({ formCheck: "missing" }),
    ])).toEqual({ toAssign: 2, waitingForm: 1 });
  });
  it("non conta pagamenti già assegnati del tutto, ignorati o confermati", () => {
    expect(paymentStepCounts([
      p({ slots: [1] }), p({ status: "ignored" }), p({ status: "confirmed" }),
      p({ availableSlots: 2, slots: [1] }),
    ])).toEqual({ toAssign: 1, waitingForm: 0 });
  });
});

describe("stepState", () => {
  it("fatto a zero, da fare sopra zero, sconosciuto senza conteggio", () => {
    expect(stepState(0)).toBe("done");
    expect(stepState(3)).toBe("todo");
    expect(stepState(null)).toBe("unknown");
  });
});
