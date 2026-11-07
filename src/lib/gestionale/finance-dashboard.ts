// Lettura dei conti per barre di avanzamento. Nessuna formula economica
// alternativa: usa soltanto i valori già calcolati dal consuntivo.
export type CashFlowBars = {
  collectedPct: number;
  spentPct: number;
  hasExpected: boolean;
  costsOverCollected: boolean;
  collected: number;
  expected: number;
};

const percent=(numerator:number,denominator:number)=>
  denominator>0 ? Math.max(0,Math.min(100,Math.round(100*numerator/denominator))) : 0;

export function cashFlowBars(values:{
  collectedCents:number;outstandingCents:number;expenseCents:number;
}): CashFlowBars {
  const collected=Math.max(0,values.collectedCents);
  const due=Math.max(0,values.outstandingCents);
  const expenses=Math.max(0,values.expenseCents);
  const expected=collected+due;
  return {
    collected,
    expected,
    collectedPct:percent(collected,expected),
    spentPct:percent(expenses,collected),
    hasExpected:expected>0,
    costsOverCollected:expenses>collected&&expenses>0,
  };
}
