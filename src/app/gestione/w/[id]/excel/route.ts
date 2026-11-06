import { notFound } from "next/navigation";

import { exportFileName } from "@/lib/gestionale/accounts";
import { formatDateTime } from "@/lib/gestionale/format";
import { getAccounts } from "@/lib/gestionale/server/accounts";
import { requireOperator } from "@/lib/gestionale/server/auth";
import { getWorkshopView } from "@/lib/gestionale/server/data";
import { buildAccountsWorkbook } from "@/lib/gestionale/server/excel";
import { logExport } from "@/lib/gestionale/server/mutations";
import { todayInRome } from "@/lib/gestionale/workshops";

// Export Excel del consuntivo (Fase 4): admin e organizzatrice (D18). Ogni
// download si registra nello storico (azione `export`).

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const operator = await requireOperator();
  const { id } = await params;

  const workshop = await getWorkshopView(id);
  if (!workshop) notFound();
  const data = await getAccounts(workshop);
  if (!data) notFound();

  const logged = await logExport(operator.id, workshop.id, "xlsx");
  if (!logged.ok) return new Response("Export non riuscito. Riprova.", { status: 500 });

  const buffer = await buildAccountsWorkbook(data, { generatedAt: formatDateTime(new Date()), operatorName: operator.displayName });
  const fileName = exportFileName(workshop.displayName, todayInRome());

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
