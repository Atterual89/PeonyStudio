export default function Home() {
  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <div className="text-lg font-semibold tracking-wide">
            Peony Studio
          </div>

          <nav className="hidden gap-6 text-sm md:flex">
            <a href="#start">Come iniziare</a>
            <a href="#programs">Programmi</a>
            <a href="#practice">Pratica</a>
            <a href="#calendar">Calendario</a>
          </nav>
        </header>

        <div className="flex flex-1 items-center">
          <div className="max-w-3xl">
            <p className="mb-5 text-sm uppercase tracking-[0.3em] text-[#8b5e4a]">
              Kinbaku · Torino
            </p>

            <h1 className="mb-6 text-5xl font-semibold leading-tight md:text-7xl">
              Uno spazio per imparare, praticare e crescere nelle corde.
            </h1>

            <p className="mb-10 max-w-2xl text-lg leading-8 text-[#5f524c]">
              Peony Studio è una scuola e community dedicata al kinbaku:
              tecnica, consapevolezza, ricerca e continuità nella pratica.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="#start"
                className="rounded-full bg-[#211815] px-6 py-3 text-center text-sm font-medium text-white"
              >
                Come iniziare
              </a>

              <a
                href="#calendar"
                className="rounded-full border border-[#211815]/20 px-6 py-3 text-center text-sm font-medium"
              >
                Guarda il calendario
              </a>
            </div>
          </div>
        </div>
      </section>

      <section
        id="start"
        className="mx-auto grid max-w-6xl gap-5 px-6 pb-20 md:grid-cols-3"
      >
        <div className="rounded-3xl bg-white/70 p-6 shadow-sm">
          <p className="mb-3 text-sm uppercase tracking-[0.2em] text-[#8b5e4a]">
            01
          </p>
          <h2 className="mb-3 text-2xl font-semibold">Come iniziare</h2>
          <p className="text-[#5f524c]">
            Open day, Foundation e primi passi per entrare nello studio con
            chiarezza.
          </p>
        </div>

        <div className="rounded-3xl bg-white/70 p-6 shadow-sm">
          <p className="mb-3 text-sm uppercase tracking-[0.2em] text-[#8b5e4a]">
            02
          </p>
          <h2 className="mb-3 text-2xl font-semibold">Programmi</h2>
          <p className="text-[#5f524c]">
            Percorsi progressivi: Foundation, Laydown, classi tematiche e
            workshop.
          </p>
        </div>

        <div className="rounded-3xl bg-white/70 p-6 shadow-sm">
          <p className="mb-3 text-sm uppercase tracking-[0.2em] text-[#8b5e4a]">
            03
          </p>
          <h2 className="mb-3 text-2xl font-semibold">Pratica</h2>
          <p className="text-[#5f524c]">
            Rope jam, pratica assistita e momenti community per continuare a
            crescere.
          </p>
        </div>
      </section>
    </main>
  );
}