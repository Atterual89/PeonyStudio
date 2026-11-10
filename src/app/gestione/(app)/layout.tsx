import { UndoProvider } from "@/components/gestionale/Deletion";
import { GestioneNav } from "@/components/gestionale/GestioneNav";
import { AdminNotificationsBell } from "@/components/gestionale/AdminNotificationsBell";
import { requireOperator } from "@/lib/gestionale/server/auth";

export default async function GestioneAppLayout({ children }: { children: React.ReactNode }) {
  const operator = await requireOperator();

  return (
    <UndoProvider>
      {operator.role === "admin" ? <div className="mx-auto flex max-w-5xl justify-end px-4 pt-3"><AdminNotificationsBell /></div> : null}
      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4">{children}</main>
      <GestioneNav role={operator.role} />
    </UndoProvider>
  );
}
