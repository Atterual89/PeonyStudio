import "server-only";

import { cache } from "react";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { requireAdmin } from "@/lib/gestionale/server/auth";

export type PeonyRevenue = {
  orders: number;
  paidCents: number;
  refundedCents: number;
  netCents: number;
  currency: string;
};
const empty = (): PeonyRevenue => ({orders:0,paidCents:0,refundedCents:0,netCents:0,currency:"EUR"});
const cents = (value: unknown) => typeof value==="number" && Number.isFinite(value) ? value : typeof value==="string" && /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : 0;
const record = (value: unknown): Record<string,unknown> => value && typeof value==="object" && !Array.isArray(value) ? value as Record<string,unknown> : {};

/** Totali effettivamente pagati su Ticket Tailor: non includere pagamenti in sede,
 * prezzi nominali, biglietti annullati o voucher come se fossero incassi.
 * Gli importi TT sono in centesimi. La voce netta sottrae i rimborsi,
 * non le commissioni del provider, che non sono disponibili qui.
 */
export const loadPeonyRevenue = cache(async (): Promise<Map<string,PeonyRevenue>> => {
  await requireAdmin();
  const db=getGestionaleDb();
  const result=new Map<string,PeonyRevenue>();
  for(let offset=0; offset<100000;offset+=500) {
    const {data,error}=await db.from("ticket_tailor_orders")
      .select("event_id,order_status,raw_payload")
      .order("id",{ascending:true}).range(offset,offset+499);
    if(error)throw new Error("Introiti Ticket Tailor: "+error.message);
    for(const row of data??[]) {
      if(!row.event_id)continue;
      const payload=record(row.raw_payload);
      const status=String(row.order_status??payload.status??"").toLowerCase();
      if(!["completed","complete"].includes(status))continue;
      const currency=record(payload.currency);
      const code=String(currency.code??"eur").toUpperCase();
      if(code!=="EUR")continue;
      const current=result.get(row.event_id)??empty();
      const paid=Math.max(0,cents(payload.total_paid));
      const refund=Math.max(0,cents(payload.refund_amount));
      current.orders+=1;
      current.paidCents+=paid;
      current.refundedCents+=refund;
      current.netCents+=paid-refund;
      result.set(row.event_id,current);
    }
    if((data??[]).length<500)break;
  }
  return result;
});

export const euro = (value: number) => new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"}).format(value/100);
