import "server-only";

import { deriveMembershipState } from "@/lib/association/membership-state";
import type { ManualIdentity } from "@/lib/association/manual-validation";
import type { MembershipPeriod } from "@/lib/association/membership-periods";
import { getGestionaleDb } from "@/lib/gestionale/server/db";

/** Verifica una singola quota manuale DAL database, dopo la scrittura.
 * Non usare la cache del libro soci e non confermare un pagamento di un altro periodo.
 */
export async function confirmManualQuotaPersisted(
  manualRowId:string|null,
  identity:ManualIdentity,
  period:MembershipPeriod,
):Promise<boolean> {
  if(!manualRowId)return false;
  const {data,error}=await getGestionaleDb().from("association_members")
    .select("first_name,last_name,email,source,membership_status,membership_starts_at,membership_expires_at")
    .eq("id",manualRowId).eq("source","manual_override").maybeSingle();
  if(error||!data)return false;
  if(data.membership_status!=="verified"||
     data.membership_starts_at!==period.paymentsFrom||
     data.membership_expires_at!==period.validUntil) return false;

  const state=deriveMembershipState([data],identity,{
    paymentsFrom:period.paymentsFrom,
    paymentsUntil:period.validUntil,
  });
  return state.status==="valid"&&state.currentYearPaid&&state.paymentMatchMethod==="manual";
}
