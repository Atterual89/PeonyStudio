import { UndoProvider } from "@/components/gestionale/Deletion";
import { GestioneNav } from "@/components/gestionale/GestioneNav";
import { requireOperator } from "@/lib/gestionale/server/auth";

export default async function GestioneAppLayout({ children }: { children: React.ReactNode }) {
  const operator = await requireOperator();

  return (
    <UndoProvider>
      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4">{children}</main>
      <GestioneNav role={operator.role} />
    </UndoProvider>
  );
}
