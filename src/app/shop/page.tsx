import { SiteHeader } from "@/components/site/SiteHeader";
import { ShopProducts } from "@/components/shop/ShopProducts";
import { shopContent } from "@/content/shop";

const TICKET_TAILOR_STORE_URL = process.env.TICKET_TAILOR_STORE_URL?.trim();

export default function ShopPage() {
  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <SiteHeader />

        <section className="py-16">
          <div className="w-full max-w-3xl">
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
              {TICKET_TAILOR_STORE_URL ? (
                <a
                  href={TICKET_TAILOR_STORE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-7 inline-flex w-full justify-center rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white shadow-[0_8px_24px_rgba(33,24,21,0.16)] transition hover:-translate-y-0.5 sm:w-auto"
                >
                  Vai direttamente allo shop su Ticket Tailor
                </a>
              ) : null}
            </div>
          </div>
        </section>

        <section className="pb-16 md:pb-24">
          <div className="mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
              {shopContent.products.eyebrow}
            </p>
            <h2 className="mt-2 font-serif text-4xl font-medium leading-[1.04] md:text-5xl">
              {shopContent.products.title}
            </h2>
          </div>
          <ShopProducts storeUrl={TICKET_TAILOR_STORE_URL} />
        </section>
      </div>
    </main>
  );
}
