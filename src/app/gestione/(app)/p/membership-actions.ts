"use server";

import { refreshGestione } from "@/lib/gestionale/server/refresh";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { confirmManualQuotaPersisted } from "@/lib/gestionale/server/manual-quota-proof";

import { revokeManualValidation, saveManualValidation } from "@/lib/association/manual-validation";
import { membershipPeriodFor, membershipPeriodForPayment } from "@/lib/association/membership-periods";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getPerson, getWorkshopView } from "@/lib/gestionale/server/data";
import { clearMembershipCache, membershipIdentityOf } from "@/lib/gestionale/server/membership";
import { logMemberValidation } from "@/lib/gestionale/server/mutations";
import type { ActionResult } from "@/lib/gestionale/types";
import { isIsoDate, isUuidLike } from "@/lib/gestionale/validation";
import { todayInRome } from "@/lib/gestionale/workshops";

// D11 (rivista): "Segna quota ok" del gestionale = la stessa validazione
// manuale della pagina admin (src/lib/association/manual-validation.ts),
// chiamata direttamente sul server (niente route con il segreto), con il
// periodo associativo del workshop (o di oggi, dalla scheda persona). Solo
// admin (requireAdmin: all'organizzatrice 404).

const INVALID: ActionResult<never> = { ok: false, error: "Dati non validi. Ricarica la pagina e riprova." };
const MISSING_IDENTITY = "Completa prima nome e cognome oppure l'email della persona.";

/**
 * `periodFrom` (4e, #15): scheda persona, inizio pagamenti del periodo scelto
 * (es. "2027-01-01"); senza workshop né periodo vale il periodo di oggi.
 */
type Target = { personId: string; workshopId?: string | null; periodFrom?: string | null };

async function resolve(input: Target) {
  if (!isUuidLike(input?.personId) || (input.workshopId != null && !isUuidLike(input.workshopId))) return null;
  if (input.periodFrom != null && (!isIsoDate(input.periodFrom) || membershipPeriodForPayment(input.periodFrom)?.paymentsFrom !== input.periodFrom)) {
    return null;
  }
  const person = await getPerson(input.personId);
  if (!person || person.merged_into) return null;
  const workshop = input.workshopId ? await getWorkshopView(input.workshopId) : null;
  if (input.workshopId && !workshop) return null;
  const period = input.periodFrom
    ? membershipPeriodForPayment(input.periodFrom)
    : membershipPeriodForPayment(todayInRome());
  const identity = await membershipIdentityOf(person);
  const complete = Boolean(identity.email?.trim()) || Boolean(identity.firstName?.trim() && identity.lastName?.trim());
  return { person, period, identity, complete };
}

export async function markQuotaOkAction(input: Target): Promise<ActionResult> {
  const operator = await requireAdmin();
  const target = await resolve(input);
  if (!target) return INVALID;
  if (!target.period) return { ok: false, error: "Il workshop è prima del primo periodo associativo (1 set 2025)." };
  if (!target.complete) return { ok: false, error: MISSING_IDENTITY };

  const result = await saveManualValidation(target.identity, { period: target.period });
  if (!result.ok) return { ok: false, error: "Validazione non riuscita. Riprova." };
  if(!await confirmManualQuotaPersisted(result.id,target.identity,target.period)) {
    return {ok:false,error:"La quota non risulta verificata nel database per questo periodo. Aggiorna lo stato prima di ripetere l’operazione."};
  }
  await logMemberValidation(operator.id, target.person.id, "quota_ok", { periodo: target.period, riga: result.id });
  await clearMembershipCache();
  refreshGestione();
  return { ok: true };
}

export async function revokeQuotaOkAction(input: Target): Promise<ActionResult> {
  const operator = await requireAdmin();
  const target = await resolve(input);
  if (!target || !target.period) return INVALID;
  if (!target.complete) return { ok: false, error: MISSING_IDENTITY };

  const result = await revokeManualValidation(target.identity, { period: target.period });
  if (!result.ok) return { ok: false, error: "Annullamento non riuscito. Riprova." };
  if (result.revoked === 0) return { ok: false, error: "Nessuna validazione manuale da annullare per questo periodo." };
  await logMemberValidation(operator.id, target.person.id, "annulla_quota_ok", { periodo: target.period, righe: result.revoked });
  await clearMembershipCache();
  refreshGestione();
  return { ok: true };
}

/** "Aggiorna stato soci": svuota la cache delle fonti dei soci del gestionale. */
export async function refreshMembershipAction(): Promise<ActionResult> {
  await requireAdmin();
  await clearMembershipCache();
  refreshGestione();
  return { ok: true };
}

/** Registra la quota direttamente dalla domanda Google, anche senza gw_people. */
export async function setFormQuotaPaidAction(formMemberId: string, paid: boolean, periodDate?: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isUuidLike(formMemberId) || typeof paid !== "boolean") return INVALID;
  const db = getGestionaleDb();
  const { data: form, error } = await db.from("association_members")
    .select("id,first_name,last_name,email")
    .eq("id", formMemberId).eq("source", "google_sheet")
    .maybeSingle();
  if (error || !form) return { ok: false, error: "Domanda Google non trovata. Aggiorna le domande." };
  const today = todayInRome();
  const period = membershipPeriodForPayment(periodDate ?? today);
  const currentPeriod = membershipPeriodForPayment(today);
  if (!period || !currentPeriod) return { ok: false, error: "Periodo associativo non valido." };
  // Pagamenti del periodo attuale e rinnovi dell'anno successivo soltanto.
  if (period.paymentsFrom < currentPeriod.paymentsFrom ||
    Number(period.validUntil.slice(0, 4)) > Number(today.slice(0, 4)) + 1) {
    return { ok: false, error: "Puoi confermare la quota del periodo attuale o dell'anno successivo." };
  }
  if (!form.email && !(form.first_name && form.last_name)) return { ok: false, error: MISSING_IDENTITY };

  const identity = { email: form.email, firstName: form.first_name, lastName: form.last_name };
  const result = paid
    ? await saveManualValidation(identity, { period })
    : await revokeManualValidation(identity, { period });
  if (!result.ok) return { ok: false, error: "Salvataggio quota non riuscito." };
  if (paid && !await confirmManualQuotaPersisted("id" in result ? result.id : null,identity,period)) {
    return {ok:false,error:"La quota non risulta verificata nel database. Aggiorna lo stato prima di ripetere l’operazione."};
  }
  if (!paid && "revoked" in result && result.revoked === 0)
    return { ok: false, error: "Nessuna quota confermata manualmente da annullare." };

  await clearMembershipCache();
  refreshGestione();
  return { ok: true };
}
