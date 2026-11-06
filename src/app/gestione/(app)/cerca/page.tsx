import { GlobalSearch } from "@/components/gestionale/GlobalSearch";
import { requireAdmin } from "@/lib/gestionale/server/auth";

export default async function CercaPage() {
  await requireAdmin();
  return (
    <section className="max-w-2xl">
      <h1 className="font-serif text-xl font-medium">Cerca</h1>
      <div className="mt-4">
        <GlobalSearch />
      </div>
    </section>
  );
}
