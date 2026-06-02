"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type ShopProduct = {
  id: string;
  name: string;
  variant?: string;
  description?: string;
  price?: string;
  currency?: string;
  image?: string;
  quantity?: number;
  status?: string;
};

export function ShopProducts({ storeUrl }: { storeUrl: string }) {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      try {
        const response = await fetch("/api/ticket-tailor/products");
        const payload = await response.json();

        if (isMounted) {
          setProducts(Array.isArray(payload.products) ? payload.products : []);
        }
      } catch {
        if (isMounted) {
          setProducts([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-[8px] border border-[#211815]/10 bg-white/35 p-5 text-sm text-[#5f524c]">
        Caricamento prodotti...
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="rounded-[8px] border border-dashed border-[#211815]/15 bg-white/30 p-5 text-sm leading-[1.7] text-[#5f524c]">
        I prodotti disponibili verranno mostrati qui quando lo store Ticket
        Tailor sarà attivo.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const title = product.variant
          ? `${product.name} — ${product.variant}`
          : product.name;

        return (
          <article
            key={product.id}
            className="overflow-hidden rounded-[8px] border border-[#211815]/10 bg-white/42 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]"
          >
            {product.image && !failedImages[product.id] ? (
              <div className="relative h-44 bg-[#efe4d7]">
                <Image
                  src={product.image}
                  alt={title}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                  onError={() =>
                    setFailedImages((current) => ({
                      ...current,
                      [product.id]: true,
                    }))
                  }
                />
              </div>
            ) : null}
            <div className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b5e4a]">
                {product.status ?? "ON_SALE"}
              </p>
              <h2 className="mt-2 font-serif text-2xl font-medium leading-[1.08]">
                {title}
              </h2>
              {product.description ? (
                <p className="mt-2 line-clamp-3 text-sm leading-[1.6] text-[#5f524c]">
                  {product.description}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[#5f524c]">
                {product.price ? (
                  <span className="rounded-full border border-[#211815]/10 bg-[#f4efe8]/80 px-3 py-1.5 font-medium text-[#211815]">
                    {product.price}
                  </span>
                ) : null}
                {typeof product.quantity === "number" ? (
                  <span className="rounded-full border border-[#211815]/10 bg-white/45 px-3 py-1.5">
                    Disponibili: {product.quantity}
                  </span>
                ) : null}
              </div>
              <a
                href={storeUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex w-full justify-center rounded-full bg-[#211815] px-4 py-2.5 text-sm font-medium text-white transition hover:-translate-y-0.5"
              >
                Acquista
              </a>
            </div>
          </article>
        );
      })}
    </div>
  );
}
