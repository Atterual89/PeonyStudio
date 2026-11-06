import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vademecum Rope Jam / Open Day | Peony Studio",
  description:
    "Informazioni utili, regole di convivenza, consenso e sicurezza per Rope Jam e Open Day a Peony Studio Torino.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="border-t border-[#cdbda9] pt-8 md:pt-10">
    <h2 className="font-serif text-3xl md:text-4xl font-medium text-[#741f2d]">
      {title}
    </h2>
    <div className="mt-5 space-y-4 text-[16px] leading-7 text-[#302822]">
      {children}
    </div>
  </section>
);

export default function VademecumRopeJamPage() {
  return (
    <main className="bg-[#f4efe8]">
      <div className="mx-auto w-full max-w-4xl px-5 py-12 md:px-8 md:py-20">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8f2635]">
            Peony Studio · Torino
          </p>
          <h1 className="mt-4 font-serif text-5xl font-medium italic leading-none text-[#1d1814] md:text-7xl">
            Vademecum Rope Jam
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[#5b493d]">
            Qualche informazione utile per la tua permanenza a Peony Studio.
          </p>
        </header>

        <div className="mt-10 rounded-2xl border border-[#d9c2a2] bg-[#efe2d1] p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8f2635]">
            Nota importante per le coppie che praticano shibari
          </p>

          <div className="mt-4 space-y-4 text-[16px] leading-7 text-[#302822]">
            <p>
              Durante gli eventi saranno sempre presenti degli{" "}
              <strong>spotter</strong> che faranno del loro meglio per tutelare
              la sicurezza. Queste persone avranno la facoltà di chiedere ai
              partecipanti di slegare qualora lo reputassero opportuno.
            </p>

            <p>
              <strong>
                Tuttavia, la responsabilità sull&apos;incolumità della persona
                legata è in carico alla coppia che pratica shibari e non allo
                Studio, all&apos;Associazione o agli organizzatori
                dell&apos;evento.
              </strong>
            </p>

            <p>
              Il bondage porta con sé dei <strong>rischi</strong>: raccomandiamo
              di agire sempre in maniera consapevole e considerata, con un
              approccio <strong>SAFETY-FIRST</strong>.
            </p>
          </div>
        </div>

        <article className="mt-12 space-y-10 md:mt-16 md:space-y-12">
          <Section title="Informativa per i partecipanti alla Rope Jam / Open Day">
            <p>
              Benvenuta/o alla <strong>Rope Jam di Peony Studio</strong>. Per
              garantire un ambiente sicuro, rispettoso e accogliente, ti
              invitiamo a leggere attentamente questa informativa.
            </p>
          </Section>

          <Section title="🌈 I colori alla Rope Jam">
            <p>
              I partecipanti possono indossare <strong>uno o più braccialetti</strong>{" "}
              in base alle proprie necessità.
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-[#dfc5a6] bg-[#fffaf2] p-5">
                <h3 className="font-serif text-2xl font-medium text-[#1d1814]">
                  🟠 Arancione
                </h3>
                <p className="mt-3">
                  Sono disponibile a <strong>legare</strong>, previo contatto e
                  conoscenza preliminare. Durante la sessione il braccialetto può
                  essere tolto.
                </p>
              </div>

              <div className="rounded-2xl border border-[#c9d7c4] bg-[#fffaf2] p-5">
                <h3 className="font-serif text-2xl font-medium text-[#1d1814]">
                  🟢 Verde
                </h3>
                <p className="mt-3">
                  Sono disponibile a <strong>essere legata/o</strong>, previo
                  contatto e conoscenza preliminare. Durante la sessione il
                  braccialetto può essere tolto.
                </p>
              </div>

              <div className="rounded-2xl border border-[#d9d4ca] bg-[#fffaf2] p-5">
                <h3 className="font-serif text-2xl font-medium text-[#1d1814]">
                  ⚪ Bianco
                </h3>
                <p className="mt-3">
                  Accetto di essere fotografata/o{" "}
                  <strong>dallo staff ufficiale</strong>. Le foto verranno
                  condivise solo in privato.
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-[#fffaf2] p-5 md:p-6">
              <p>
                Il braccialetto bianco deve essere <strong>visibile</strong>{" "}
                durante la sessione:
              </p>
              <ol className="mt-3 list-decimal space-y-2 pl-6">
                <li>
                  Per semplicità, se <strong>chi lega</strong> indossa il
                  braccialetto bianco, le foto verranno scattate alla coppia.
                </li>
                <li>
                  In alternativa, è possibile{" "}
                  <strong>posizionare il braccialetto sul tappeto</strong> in
                  vista del fotografo e le foto verranno scattate alla coppia.
                </li>
              </ol>
              <p className="mt-4">
                Ti chiediamo gentilmente di{" "}
                <strong>restituire i braccialetti a fine serata</strong>.
              </p>
            </div>
          </Section>

          <Section title="🌍 Inclusività e rispetto">
            <p>
              Tutti sono i benvenuti, indipendentemente da origine, genere,
              orientamento o religione. Peony Studio è uno{" "}
              <strong>spazio apolitico</strong>, dove la libertà di espressione
              è incoraggiata nel rispetto delle differenze culturali e delle
              altre persone presenti.
            </p>
          </Section>

          <Section title="🟢 Cultura del consenso">
            <p>
              Ogni attività deve basarsi su un{" "}
              <strong>consenso chiaro ed esplicito</strong>. Il comfort e i
              limiti di ogni partecipante devono essere rispettati in ogni
              momento.
            </p>
          </Section>

          <Section title="⚠️ Safety First!">
            <p>
              Lo shibari comporta dei rischi: agisci sempre con consapevolezza.
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Durante le sessioni saranno presenti <strong>spotter</strong>{" "}
                per monitorare le pratiche, con la facoltà di interrompere una
                sessione se necessario.
              </li>
              <li>
                La responsabilità dell&apos;incolumità della persona legata è
                della coppia che pratica,{" "}
                <strong>
                  non dello Studio, dell&apos;Associazione o degli organizzatori
                  dell&apos;evento
                </strong>
                .
              </li>
            </ul>
          </Section>

          <Section title="🏡 Rispetto degli spazi comuni">
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Usa la cucina e le aree condivise, ma lascia tutto in ordine.
              </li>
              <li>
                Mantieni il rumore sotto controllo, soprattutto nelle aree
                vicine al vicinato.
              </li>
              <li>
                È consentito fumare solo all&apos;esterno del palazzo e lontano
                dall&apos;ingresso e dai residenti.
              </li>
            </ul>
          </Section>

          <Section title="📏 Spazio personale e gestione delle sessioni">
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Osservare è lecito,{" "}
                <strong>invadere lo spazio altrui no</strong>. Rispetta i
                confini fisici ed emotivi di chi pratica.
              </li>
              <li>
                Dopo aver terminato la legatura ed essersi presi il giusto
                momento di <strong>aftercare</strong>, è necessario liberare lo
                spazio per permettere ad altri di praticare.
              </li>
            </ul>
          </Section>

          <Section title="📸 Politica su foto e video">
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Scatta foto <strong>solo con il consenso</strong> della persona
                legata, evitando di includere altri partecipanti.
              </li>
              <li>
                Durante le Rope Jam potrebbe essere presente un{" "}
                <strong>fotografo ufficiale</strong>. Se desideri essere
                fotografata/o, indossa il <strong>braccialetto bianco</strong>{" "}
                per segnalare il consenso.
              </li>
              <li>
                Ogni abuso o comportamento contrario alle indicazioni verrà
                valutato dallo staff e gestito di conseguenza.
              </li>
            </ul>
          </Section>

          <Section title="👕 Dress code e nudità">
            <p>
              Non c&apos;è un dress code specifico: vestiti come ti senti a tuo
              agio. Tuttavia, <strong>non è consentita la nudità totale</strong>.
            </p>
            <p>
              <strong>I genitali devono rimanere coperti.</strong>
            </p>
          </Section>

          <Section title="📢 Comunicazione aperta">
            <p>
              Hai domande, dubbi o suggerimenti? Parlane con gli organizzatori o
              con lo staff: siamo qui per creare un ambiente positivo, sicuro e
              in crescita.
            </p>
            <p className="font-medium">
              Grazie per contribuire a rendere la Rope Jam un&apos;esperienza
              sicura e piacevole per tutti.
            </p>
          </Section>
        </article>
      </div>
    </main>
  );
}
