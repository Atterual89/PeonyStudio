import Link from "next/link";

export default function GestioneNotFound() {
  return (
    <section className="py-10 text-center">
      <h1 className="font-serif text-xl font-medium">Non trovato</h1>
      <p className="mt-2 text-[#5f524c]">L&apos;elemento non esiste o è stato unito a un altro.</p>
      <Link prefetch={false} href="/gestione" className="mt-4 inline-block underline">
        Torna ai workshop
      </Link>
    </section>
  );
}
