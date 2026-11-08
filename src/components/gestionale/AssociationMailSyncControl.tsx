import "server-only";

import { SyncAssociationMailButton } from "@/components/gestionale/SyncAssociationMailButton";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { gmailConnectionStatus } from "@/lib/gestionale/server/payment-gmail-oauth";

/** Un unico controllo Gmail, usato ovunque si controlla il libro soci.
 * Le credenziali restano server-side: al client passano solo boolean e date.
 */
export async function AssociationMailSyncControl() {
  await requireAdmin();
  const [gmail, checkpoint] = await Promise.all([
    gmailConnectionStatus(),
    getGestionaleDb().from("gw_payment_sync_state")
      .select("last_success_at")
      .eq("source", "gmail_payments")
      .maybeSingle(),
  ]);
  return (
    <SyncAssociationMailButton
      configured={gmail.configured}
      connected={gmail.connected}
      missing={gmail.missing}
      lastSync={checkpoint.error ? null : checkpoint.data?.last_success_at ?? null}
    />
  );
}
