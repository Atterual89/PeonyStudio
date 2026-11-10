import { PageLoading } from "@/components/gestionale/ui";

// La pagina apre subito i comandi; ogni fonte lenta ha una propria Suspense.
export default function Loading() {
  return <PageLoading label="Apertura verifiche…" />;
}
