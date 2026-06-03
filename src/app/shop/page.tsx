import { SiteHeader } from "@/components/site/SiteHeader";
import { ShopHeroClient } from "@/components/shop/ShopHeroClient";
import { ShopProducts } from "@/components/shop/ShopProducts";
import { ShopProductsHeader } from "@/components/shop/ShopProductsHeader";

const TICKET_TAILOR_STORE_URL = process.env.TICKET_TAILOR_STORE_URL?.trim();

export default function ShopPage() {
  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <SiteHeader />

        <section className="py-16">
          <div className="w-full max-w-3xl">
            <ShopHeroClient storeUrl={TICKET_TAILOR_STORE_URL} />
          </div>
        </section>

        <section className="pb-16 md:pb-24">
          <ShopProductsHeader />
          <ShopProducts storeUrl={TICKET_TAILOR_STORE_URL} />
        </section>
      </div>
    </main>
  );
}
