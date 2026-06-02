import { SiteHeader } from "@/components/site/SiteHeader";
import { ShopProducts } from "@/components/shop/ShopProducts";
import { shopContent } from "@/content/shop";

const TICKET_TAILOR_STORE_URL =
  process.env.TICKET_TAILOR_STORE_URL ?? "INSERIRE_LINK_STORE_TICKET_TAILOR";

export default function ShopPage() {
  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <SiteHeader />

        <section className="py-16">
          <div className="grid w-full gap-8 md:grid-cols-[0.95fr_1.05fr] md:items-center">
            <div className="max-w-3xl">
              <p className="mb-5 text-sm uppercase tracking-[0.3em] text-[#8b5e4a]">
                {shopContent.hero.eyebrow}
              </p>
              <h1 className="mb-6 font-serif text-5xl font-medium leading-[1.02] md:text-7xl">
                {shopContent.hero.title}
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[#5f524c]">
                {shopContent.hero.intro}
              </p>
            </div>

            <aside className="rounded-[8px] border border-[#211815]/10 bg-white/40 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:p-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
                Store Ticket Tailor
              </p>
              <div className="mt-4 grid gap-4 text-[15px] leading-[1.75] text-[#5f524c]">
                <p>
                  Libri, journal, preorder e prodotti selezionati di Peony
                  Studio. Acquisto e pagamento sono gestiti tramite Ticket
                  Tailor.
                </p>
                <p lang="en">
                  Books, journals, preorders and selected Peony Studio products.
                  Purchases and payments are managed through Ticket Tailor.
                </p>
              </div>
              <a
                href={TICKET_TAILOR_STORE_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex w-full justify-center rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white shadow-[0_8px_24px_rgba(33,24,21,0.16)] transition hover:-translate-y-0.5 sm:w-auto"
              >
                <span className="mr-2">Apri lo shop</span>
                <span aria-hidden="true" className="text-white/55">
                  /
                </span>
                <span className="ml-2" lang="en">
                  Open the shop
                </span>
              </a>
            </aside>
          </div>
        </section>

        <section className="pb-16 md:pb-24">
          <div className="mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
              Prodotti
            </p>
            <h2 className="mt-2 font-serif text-4xl font-medium leading-[1.04] md:text-5xl">
              Disponibili nello shop
            </h2>
          </div>
          <ShopProducts storeUrl={TICKET_TAILOR_STORE_URL} />
        </section>
      </div>
    </main>
  );
}
