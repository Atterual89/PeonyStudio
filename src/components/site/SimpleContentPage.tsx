import { SiteHeader } from "@/components/site/SiteHeader";

type SimpleContentPageProps = {
  eyebrow?: string;
  title: string;
  intro?: string;
};

export function SimpleContentPage({
  eyebrow,
  title,
  intro,
}: SimpleContentPageProps) {
  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <SiteHeader />

        <section className="flex flex-1 items-center">
          <div className="max-w-3xl">
            {eyebrow ? (
              <p className="mb-5 text-sm uppercase tracking-[0.3em] text-[#8b5e4a]">
                {eyebrow}
              </p>
            ) : null}

            <h1 className="mb-6 text-5xl font-semibold leading-tight md:text-7xl">
              {title}
            </h1>

            {intro ? (
              <p className="max-w-2xl text-lg leading-8 text-[#5f524c]">
                {intro}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
