"use client";

export default function GestioneError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-16 text-center">
      <h1 className="font-serif text-2xl font-medium">Si è verificato un errore</h1>
      <p className="mt-3 text-[#5f524c]">Non è stato possibile caricare la pagina. Riprova tra qualche istante.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 min-h-12 rounded-xl bg-[#a8583e] px-6 font-semibold text-white"
      >
        Riprova
      </button>
    </main>
  );
}
