import { PageLoading } from "@/components/gestionale/ui";

// Fase 5: la lettura del libro soci (Google Sheet) può richiedere qualche secondo.
export default function Loading() {
  return <PageLoading label="Lettura del libro soci…" />;
}
