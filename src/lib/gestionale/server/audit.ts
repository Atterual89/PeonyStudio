import "server-only";

import { AUDIT_PAGE_SIZE, cleanAuditValue, isAuditKind, type AuditEntry, type AuditKind } from "@/lib/gestionale/audit";
import { requireAdmin, requireOperator } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import type { OperatorRole } from "@/lib/gestionale/types";

// Storico modifiche (Fase 5, D27): lettura con gw_audit_list (migrazione 027).
// Tutti e due i ruoli; il ruolo lo prende il server dalla sessione e il
// filtro per l'organizzatrice lo fa Postgres (solo iscrizioni, pagamenti,
// spese, trasferimenti, riporti, stato dei conti; persone solo come
// entered_as; niente nomi degli operatori). Operatore e persona si filtrano
// solo per gli admin. L'elenco degli operatori (id e nome) solo agli admin.

function fail(context: string, error: { message: string }): never {
  throw new Error(`Gestionale (${context}): ${error.message}`);
}

export type AuditFilters = {
  operatorId: string | null;
  workshopId: string | null;
  kind: AuditKind | null;
  personId: string | null;
  page: number;
};

type AuditRecord = {
  id: number | string;
  created_at: string;
  operator_name: string | null;
  operator_role: OperatorRole | null;
  entity: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  workshop_id: string | null;
  workshop_name: string | null;
  subject: string | null;
  total: number | string;
};

const asObject = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? (cleanAuditValue(value) as Record<string, unknown>) : null);

export async function getAuditPage(filters: AuditFilters): Promise<{ entries: AuditEntry[]; total: number }> {
  const operator = await requireOperator();
  const isAdmin = operator.role === "admin";
  const { data, error } = await getGestionaleDb().rpc("gw_audit_list", {
    p_viewer_role: operator.role,
    p_filter_operator: isAdmin ? filters.operatorId : null,
    p_workshop_id: filters.workshopId,
    p_kind: filters.kind && isAuditKind(filters.kind, operator.role) ? filters.kind : null,
    p_person_id: isAdmin ? filters.personId : null,
    p_offset: (filters.page - 1) * AUDIT_PAGE_SIZE,
    p_limit: AUDIT_PAGE_SIZE,
  });
  if (error) fail("storico", error);
  const rows = (data ?? []) as AuditRecord[];
  return {
    total: rows.length ? Number(rows[0].total) : 0,
    entries: rows.map((row) => ({
      id: Number(row.id),
      createdAt: row.created_at,
      operatorName: isAdmin ? row.operator_name : null,
      operatorRole: row.operator_role,
      entity: row.entity,
      action: row.action,
      before: asObject(row.before),
      after: asObject(row.after),
      workshopId: row.workshop_id,
      workshopName: row.workshop_name,
      subject: row.subject,
    })),
  };
}

/** Operatori per il filtro: solo id e nome (mai PIN o hash). */
export async function listOperatorNames(): Promise<{ id: string; name: string }[]> {
  await requireAdmin();
  const { data, error } = await getGestionaleDb().from("gw_operators").select("id, display_name").order("display_name");
  if (error) fail("operatori", error);
  return ((data ?? []) as { id: string; display_name: string }[]).map((row) => ({ id: row.id, name: row.display_name }));
}
