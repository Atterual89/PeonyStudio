"use client";

import Image from "next/image";
import {
  FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useLanguage } from "@/components/site/LanguageProvider";

import {
  shopBilingual,
  shopContent,
  type PeonyCardVariant,
  type RopeProduct,
} from "@/content/shop";

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

type SectionKey = "peony-card" | "gift-card" | "corde";
type CardLevel = "Bronze" | "Silver" | "Gold" | "Platinum";

type RopeInquiry = {
  name: string;
  contact: string;
  producer: "Europa" | "Ogawa";
  treatment: "grezza" | "trattata";
  diameter: "4,5 mm" | "5 mm" | "5,5 mm" | "6 mm";
  quantity: string;
  notes: string;
};

const SHOP_CHOICES: {
  key: SectionKey;
  title: string;
  text: string;
}[] = [
  {
    key: "peony-card",
    title: "Peony Card",
    text: "Accessi, priorità, sconti e benefit per la stagione 2026/2027.",
  },
  {
    key: "gift-card",
    title: "Gift Card",
    text: "Voucher e gift card da acquistare tramite Ticket Tailor.",
  },
  {
    key: "corde",
    title: "Corde",
    text: "Corde in iuta disponibili in sede, con pagamento e ritiro di persona.",
  },
];

const CARD_QUIZ = [
  {
    question: "Che tipo di attività pensi di frequentare di più?",
    options: [
      {
        label: "Rope Jam / Open Day / eventi sociali",
        scores: { Bronze: 3, Silver: 1 },
      },
      {
        label: "Pratica Assistita e Classi Tematiche",
        scores: { Silver: 3, Gold: 1 },
      },
      {
        label: "Workshop con Kurogami & Shiawase",
        scores: { Gold: 3, Platinum: 1 },
      },
      {
        label: "Un mix di tutto",
        scores: { Platinum: 3, Gold: 2 },
      },
    ],
  },
  {
    question: "Quanto pensi di frequentare Peony durante la stagione?",
    options: [
      { label: "Ogni tanto", scores: { Bronze: 3 } },
      { label: "Una volta al mese", scores: { Silver: 3 } },
      { label: "Due o più volte al mese", scores: { Gold: 3 } },
      {
        label: "Voglio vivere la stagione il più possibile",
        scores: { Platinum: 3 },
      },
    ],
  },
  {
    question: "Ti interessa anche lavorare in modo individuale con gli insegnanti?",
    options: [
      {
        label: "No, mi interessano soprattutto eventi e pratica",
        scores: { Bronze: 2, Silver: 1 },
      },
      { label: "Sì, mi interessa una lezione privata", scores: { Gold: 3 } },
      {
        label: "Sì, mi interessa anche coaching individuale",
        scores: { Platinum: 3 },
      },
    ],
  },
  {
    question: "Ti interessano i workshop e la priorità di prenotazione?",
    options: [
      { label: "Poco", scores: { Bronze: 3 } },
      { label: "Sì, qualche workshop", scores: { Silver: 2, Gold: 1 } },
      {
        label: "Sì, voglio partecipare spesso e prenotare prima",
        scores: { Gold: 2, Platinum: 3 },
      },
    ],
  },
] satisfies {
  question: string;
  options: {
    label: string;
    scores: Partial<Record<CardLevel, number>>;
  }[];
}[];

const CARD_RESULT_COPY: Record<CardLevel, string> = {
  Bronze:
    "È la scelta più leggera se pensi di partecipare soprattutto a Rope Jam, Open Day o eventi sociali, con una frequenza saltuaria.",
  Silver:
    "È adatta se vuoi iniziare a frequentare con più continuità pratiche, classi tematiche e qualche workshop.",
  Gold:
    "È pensata per una presenza regolare, con pratiche, workshop, priorità e una lezione privata inclusa.",
  Platinum:
    "È la card più completa se vuoi vivere la stagione il più possibile, con workshop frequenti, lezione privata e coaching individuale.",
};

export function ShopProducts({ storeUrl }: { storeUrl?: string }) {
  const { dictionary, locale } = useLanguage();
  const shopDict = dictionary.shop;
  const localizedShop = shopBilingual[locale] ?? shopBilingual.it;
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    "peony-card": false,
    "gift-card": false,
    corde: false,
  });
  const [ropeModalOpen, setRopeModalOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [highlightedCard, setHighlightedCard] = useState<CardLevel | null>(null);

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

  const peonyCardProducts = useMemo(
    () =>
      products.filter(
        (product) => normalizeText(product.name) === "peony card 2027",
      ),
    [products],
  );

  const giftCardProducts = useMemo(
    () =>
      products.filter((product) =>
        normalizeText(product.name).includes("peony gift card"),
      ),
    [products],
  );

  const openAndScroll = (section: SectionKey) => {
    setOpenSections((current) => ({ ...current, [section]: true }));
    window.setTimeout(() => {
      document.getElementById(section)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  };

  const toggleSection = (section: SectionKey) => {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const focusRecommendedCard = (card: CardLevel) => {
    setHighlightedCard(card);
    openAndScroll("peony-card");
    window.setTimeout(() => {
      document
        .getElementById(`peony-card-${normalizeText(card)}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 180);
  };

  if (loading) {
    return (
      <div className="rounded-[8px] border border-[#211815]/10 bg-white/35 p-5 text-sm text-[#5f524c]">
        {shopDict.loading}
      </div>
    );
  }

  return (
    <div className="grid gap-7 md:gap-9">
      <section className="rounded-[8px] border border-[#211815]/10 bg-white/35 p-4 md:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
          {shopDict.whatLooking}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {SHOP_CHOICES.map((choice, index) => {
            const choiceText = shopDict.shopChoices[index];
            return (
              <button
                key={choice.key}
                type="button"
                className="group rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/65 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/65"
                onClick={() => openAndScroll(choice.key)}
              >
                <span className="font-serif text-2xl font-medium leading-[1.08]">
                  {choiceText?.title ?? choice.title}
                </span>
                <span className="mt-2 block text-sm leading-[1.55] text-[#5f524c]">
                  {choiceText?.text ?? choice.text}
                </span>
                <span className="mt-4 inline-flex text-sm font-medium text-[#8b5e4a] transition group-hover:translate-x-1">
                  {shopDict.openSection}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <ShopAccordionSection
        id="peony-card"
        eyebrow={localizedShop.peonyCards.eyebrow}
        title={localizedShop.peonyCards.title}
        open={openSections["peony-card"]}
        onToggle={() => toggleSection("peony-card")}
      >
        <PeonyCardsSection
          products={peonyCardProducts}
          failedImages={failedImages}
          highlightedCard={highlightedCard}
          onImageError={(id) =>
            setFailedImages((current) => ({ ...current, [id]: true }))
          }
          onCompare={() => {
            setHighlightedCard(null);
            document
              .getElementById("peony-card-bronze")
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
          onOpenQuiz={() => setQuizOpen(true)}
          storeUrl={storeUrl}
        />
      </ShopAccordionSection>

      <ShopAccordionSection
        id="gift-card"
        eyebrow={localizedShop.giftCards.eyebrow}
        title={localizedShop.giftCards.title}
        open={openSections["gift-card"]}
        onToggle={() => toggleSection("gift-card")}
      >
        <GiftCardsSection
          products={giftCardProducts}
          failedImages={failedImages}
          onImageError={(id) =>
            setFailedImages((current) => ({ ...current, [id]: true }))
          }
          storeUrl={storeUrl}
        />
      </ShopAccordionSection>

      <ShopAccordionSection
        id="corde"
        eyebrow={localizedShop.ropes.eyebrow}
        title={localizedShop.ropes.title}
        open={openSections.corde}
        onToggle={() => toggleSection("corde")}
      >
        <RopesSection onOpenInquiry={() => setRopeModalOpen(true)} />
      </ShopAccordionSection>

      <PeonyCardQuizModal
        open={quizOpen}
        storeUrl={storeUrl}
        onClose={() => setQuizOpen(false)}
        onShowDetails={focusRecommendedCard}
      />
      <RopeInquiryModal
        open={ropeModalOpen}
        onClose={() => setRopeModalOpen(false)}
      />
    </div>
  );
}

function ShopAccordionSection({
  id,
  eyebrow,
  title,
  open,
  onToggle,
  children,
}: {
  id: SectionKey;
  eyebrow: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-[8px] border border-[#211815]/10 bg-white/32"
    >
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left md:px-5"
        onClick={onToggle}
      >
        <span>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
            {eyebrow}
          </span>
          <span className="mt-1 block font-serif text-3xl font-medium leading-[1.04] md:text-4xl">
            {title}
          </span>
        </span>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#211815]/10 bg-white/45 text-xl text-[#8b5e4a]">
          {open ? "−" : "+"}
        </span>
      </button>
      {open ? <div className="border-t border-[#211815]/10 p-4 md:p-5">{children}</div> : null}
    </section>
  );
}

function PeonyCardsSection({
  products,
  failedImages,
  highlightedCard,
  onImageError,
  onCompare,
  onOpenQuiz,
  storeUrl,
}: {
  products: ShopProduct[];
  failedImages: Record<string, boolean>;
  highlightedCard: CardLevel | null;
  onImageError: (id: string) => void;
  onCompare: () => void;
  onOpenQuiz: () => void;
  storeUrl?: string;
}) {
  const { dictionary } = useLanguage();
  const shopDict = dictionary.shop;
  const content = shopContent.peonyCards;

  return (
    <div className="grid gap-5">
      <SectionHeader intro={content.intro} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="inline-flex justify-center rounded-full border border-[#211815]/15 bg-white/55 px-5 py-3 text-sm font-medium text-[#211815] transition hover:bg-white"
          onClick={onCompare}
        >
          {shopDict.compareCards}
        </button>
        <button
          type="button"
          className="inline-flex justify-center rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
          onClick={onOpenQuiz}
        >
          {shopDict.helpChoose}
        </button>
      </div>
      {products.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {content.variants.map((variant) => {
            const product = findProductByVariant(products, variant.variant);

            return (
              <PeonyCardProduct
                key={variant.variant}
                variant={variant}
                product={product}
                highlighted={highlightedCard === variant.variant}
                failedImage={product ? failedImages[product.id] : false}
                onImageError={onImageError}
                storeUrl={storeUrl}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState text={shopDict.peonyCardEmpty} />
      )}
      <div className="grid gap-3">
        <DetailsBlock
          title={content.howItWorks.title}
          paragraphs={content.howItWorks.intro}
          items={content.howItWorks.items}
        />
        <DetailsBlock
          title={content.important.title}
          items={content.important.items}
        />
      </div>
    </div>
  );
}

function PeonyCardProduct({
  variant,
  product,
  highlighted,
  failedImage,
  onImageError,
  storeUrl,
}: {
  variant: PeonyCardVariant;
  product?: ShopProduct;
  highlighted: boolean;
  failedImage?: boolean;
  onImageError: (id: string) => void;
  storeUrl?: string;
}) {
  const { dictionary } = useLanguage();
  const shopDict = dictionary.shop;
  const title = `Peony Card 2027 — ${variant.variant}`;

  return (
    <article
      id={`peony-card-${normalizeText(variant.variant)}`}
      className={`scroll-mt-28 overflow-hidden rounded-[8px] border bg-white/42 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition ${
        highlighted
          ? "border-[#8b5e4a]/50 ring-2 ring-[#8b5e4a]/20"
          : "border-[#211815]/10"
      }`}
    >
      <ProductImage
        product={product}
        title={title}
        failedImage={failedImage}
        onImageError={onImageError}
        heightClassName="h-40"
      />
      <div className="grid gap-4 p-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b5e4a]">
            {variant.variant}
          </p>
          <h3 className="mt-2 font-serif text-2xl font-medium leading-[1.08]">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-[1.55] text-[#5f524c]">
            {variant.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {product?.price ? <Chip strong>{product.price}</Chip> : null}
          <Chip>{variant.value}</Chip>
          {typeof product?.quantity === "number" ? (
            <Chip>{shopDict.available}: {product.quantity}</Chip>
          ) : null}
        </div>
        <BuyButton storeUrl={storeUrl} />
        <DetailsBlock
          title={shopDict.whatIncludes}
          items={variant.benefits}
          defaultOpen={highlighted}
        />
      </div>
    </article>
  );
}

function GiftCardsSection({
  products,
  failedImages,
  onImageError,
  storeUrl,
}: {
  products: ShopProduct[];
  failedImages: Record<string, boolean>;
  onImageError: (id: string) => void;
  storeUrl?: string;
}) {
  const { dictionary } = useLanguage();
  const shopDict = dictionary.shop;
  const content = shopContent.giftCards;

  return (
    <div className="grid gap-5">
      <SectionHeader intro={content.intro} />
      {products.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const title = product.variant
              ? `Peony Gift Card — ${product.variant}`
              : product.name;

            return (
              <ProductCard
                key={product.id}
                product={product}
                title={title}
                failedImage={failedImages[product.id]}
                onImageError={onImageError}
                storeUrl={storeUrl}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState text={shopDict.giftCardEmpty} />
      )}
    </div>
  );
}

function ProductCard({
  product,
  title,
  failedImage,
  onImageError,
  storeUrl,
}: {
  product: ShopProduct;
  title: string;
  failedImage?: boolean;
  onImageError: (id: string) => void;
  storeUrl?: string;
}) {
  const { dictionary } = useLanguage();
  const shopDictForCard = dictionary.shop;

  return (
    <article className="overflow-hidden rounded-[8px] border border-[#211815]/10 bg-white/42 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
      <ProductImage
        product={product}
        title={title}
        failedImage={failedImage}
        onImageError={onImageError}
        heightClassName="h-40"
      />
      <div className="p-4">
        <h3 className="font-serif text-2xl font-medium leading-[1.08]">
          {title}
        </h3>
        {product.description ? (
          <p className="mt-2 line-clamp-3 text-sm leading-[1.6] text-[#5f524c]">
            {product.description}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {product.price ? <Chip strong>{product.price}</Chip> : null}
          {typeof product.quantity === "number" ? (
            <Chip>{shopDictForCard.available}: {product.quantity}</Chip>
          ) : null}
        </div>
        <BuyButton storeUrl={storeUrl} />
      </div>
    </article>
  );
}

function RopesSection({ onOpenInquiry }: { onOpenInquiry: () => void }) {
  const content = shopContent.ropes;
  const [selectedProducer, setSelectedProducer] = useState<string | null>(null);
  const selectedRopes = selectedProducer
    ? content.items.filter((rope) => rope.producer === selectedProducer)
    : [];

  return (
    <div className="grid gap-5">
      <SectionHeader intro={content.intro} />
      <div className="grid gap-3 sm:grid-cols-2">
        {content.producers.map((producer) => (
          <button
            type="button"
            key={producer.title}
            aria-expanded={selectedProducer === producer.title}
            className={`rounded-[8px] border p-4 text-left transition hover:-translate-y-0.5 ${
              selectedProducer === producer.title
                ? "border-[#8b5e4a]/45 bg-[#8b5e4a]/[0.08]"
                : "border-[#211815]/10 bg-white/35 hover:bg-white/55"
            }`}
            onClick={() =>
              setSelectedProducer((current) =>
                current === producer.title ? null : producer.title,
              )
            }
          >
            <span className="font-serif text-2xl font-medium">
              {producer.title}
            </span>
            <p className="mt-2 text-sm leading-[1.6] text-[#5f524c]">
              {producer.text}
            </p>
            <span className="mt-4 inline-flex text-sm font-medium text-[#8b5e4a]">
              {selectedProducer === producer.title
                ? "Nascondi dettagli"
                : "Vedi dettagli"}
            </span>
          </button>
        ))}
      </div>
      {selectedProducer ? (
        <div className="grid gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
            {selectedProducer}
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {selectedRopes.map((rope) => (
              <RopeCard key={`${rope.producer}-${rope.diameter}`} rope={rope} />
            ))}
          </div>
        </div>
      ) : null}
      <div>
        <button
          type="button"
          className="inline-flex w-full justify-center rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white shadow-[0_8px_24px_rgba(33,24,21,0.16)] transition hover:-translate-y-0.5 sm:w-auto"
          onClick={onOpenInquiry}
        >
          {content.inquiry.cta}
        </button>
      </div>
    </div>
  );
}

function RopeCard({ rope }: { rope: RopeProduct }) {
  return (
    <article className="rounded-[8px] border border-[#211815]/10 bg-white/42 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b5e4a]">
        {rope.producer}
      </p>
      <h3 className="mt-2 font-serif text-3xl font-medium leading-[1.04]">
        {rope.diameter}
      </h3>
      <div className="mt-4 flex flex-wrap gap-2">
        <UseChip active={rope.floorwork} label="Terra" />
        <UseChip active={rope.suspensionHarness} label="Harness" />
        <UseChip active={rope.suspensionUpline} label="Upline" />
      </div>
    </article>
  );
}

function PeonyCardQuizModal({
  open,
  storeUrl,
  onClose,
  onShowDetails,
}: {
  open: boolean;
  storeUrl?: string;
  onClose: () => void;
  onShowDetails: (card: CardLevel) => void;
}) {
  const [answers, setAnswers] = useState<number[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);

  useModalLock(open, onClose);

  if (!open) {
    return null;
  }

  const completed = answers.length === CARD_QUIZ.length;
  const result = completed ? getCardQuizResult(answers) : null;
  const question = CARD_QUIZ[currentQuestion];

  const chooseAnswer = (answerIndex: number) => {
    const nextAnswers = [...answers];
    nextAnswers[currentQuestion] = answerIndex;
    setAnswers(nextAnswers.slice(0, currentQuestion + 1));

    if (currentQuestion < CARD_QUIZ.length - 1) {
      setCurrentQuestion((current) => current + 1);
    }
  };

  const resetQuiz = () => {
    setAnswers([]);
    setCurrentQuestion(0);
  };

  return (
    <ModalFrame
      labelledBy="peony-card-quiz-title"
      onClose={onClose}
      closeLabel="Chiudi quiz Peony Card"
    >
      {result ? (
        <div className="grid gap-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
            Risultato
          </p>
          <div>
            <h2
              id="peony-card-quiz-title"
              className="font-serif text-4xl font-medium leading-[1.02]"
            >
              Ti consigliamo: {result}
            </h2>
            <p className="mt-3 text-[15px] leading-[1.7] text-[#5f524c]">
              {CARD_RESULT_COPY[result]}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="inline-flex justify-center rounded-full border border-[#211815]/15 bg-white/55 px-5 py-3 text-sm font-medium text-[#211815] transition hover:bg-white"
              onClick={() => {
                onClose();
                onShowDetails(result);
              }}
            >
              Guarda dettagli
            </button>
            {storeUrl ? (
              <a
                href={storeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex justify-center rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
              >
                Acquista
              </a>
            ) : null}
            <button
              type="button"
              className="inline-flex justify-center rounded-full border border-[#211815]/15 px-5 py-3 text-sm font-medium text-[#211815] transition hover:bg-white/45"
              onClick={resetQuiz}
            >
              Rifai il quiz
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
            Domanda {currentQuestion + 1} di {CARD_QUIZ.length}
          </p>
          <h2
            id="peony-card-quiz-title"
            className="font-serif text-3xl font-medium leading-[1.06] md:text-4xl"
          >
            {question.question}
          </h2>
          <div className="grid gap-2">
            {question.options.map((option, index) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={answers[currentQuestion] === index}
                className={`rounded-[8px] border px-4 py-3 text-left text-sm leading-[1.55] transition ${
                  answers[currentQuestion] === index
                    ? "border-[#8b5e4a]/45 bg-[#8b5e4a]/[0.08] text-[#211815]"
                    : "border-[#211815]/10 bg-white/45 text-[#5f524c] hover:bg-white/70"
                }`}
                onClick={() => chooseAnswer(index)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex justify-between gap-2">
            <button
              type="button"
              className="rounded-full border border-[#211815]/15 px-4 py-2.5 text-sm font-medium text-[#211815] disabled:opacity-40"
              disabled={currentQuestion === 0}
              onClick={() =>
                setCurrentQuestion((current) => Math.max(current - 1, 0))
              }
            >
              Indietro
            </button>
            <button
              type="button"
              className="rounded-full border border-[#211815]/15 px-4 py-2.5 text-sm font-medium text-[#211815]"
              onClick={onClose}
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </ModalFrame>
  );
}

function RopeInquiryModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState<RopeInquiry>({
    name: "",
    contact: "",
    producer: "Europa",
    treatment: "grezza",
    diameter: "5,5 mm",
    quantity: "1",
    notes: "",
  });

  useModalLock(open, onClose);

  if (!open) {
    return null;
  }

  const updateField = <Key extends keyof RopeInquiry>(
    key: Key,
    value: RopeInquiry[Key],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const body = [
      "Richiesta corde Peony Studio",
      "",
      `Nome / nickname: ${form.name}`,
      `Contatto: ${form.contact}`,
      `Produttore: ${form.producer}`,
      `Trattamento: ${form.treatment}`,
      `Diametro: ${form.diameter}`,
      `Numero corde: ${form.quantity}`,
      `Note: ${form.notes || "-"}`,
    ].join("\n");

    const mailto = `mailto:${shopContent.ropes.inquiry.email}?subject=${encodeURIComponent(
      shopContent.ropes.inquiry.subject,
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
    onClose();
  };

  return (
    <ModalFrame
      labelledBy="rope-inquiry-title"
      onClose={onClose}
      closeLabel="Chiudi richiesta corde"
    >
      <form onSubmit={handleSubmit}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
          Corde
        </p>
        <h2
          id="rope-inquiry-title"
          className="mt-2 font-serif text-4xl font-medium leading-[1.02]"
        >
          Richiedi corde
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <TextInput
            label="Nome o nickname"
            required
            value={form.name}
            onChange={(value) => updateField("name", value)}
          />
          <TextInput
            label="Contatto"
            required
            value={form.contact}
            placeholder="Email / Telegram / telefono"
            onChange={(value) => updateField("contact", value)}
          />
          <SelectInput
            label="Produttore"
            value={form.producer}
            options={["Europa", "Ogawa"]}
            onChange={(value) =>
              updateField("producer", value as RopeInquiry["producer"])
            }
          />
          <SelectInput
            label="Trattamento"
            value={form.treatment}
            options={["grezza", "trattata"]}
            onChange={(value) =>
              updateField("treatment", value as RopeInquiry["treatment"])
            }
          />
          <SelectInput
            label="Diametro"
            value={form.diameter}
            options={["4,5 mm", "5 mm", "5,5 mm", "6 mm"]}
            onChange={(value) =>
              updateField("diameter", value as RopeInquiry["diameter"])
            }
          />
          <TextInput
            label="Numero corde"
            required
            type="number"
            min="1"
            value={form.quantity}
            onChange={(value) => updateField("quantity", value)}
          />
          <label className="grid gap-2 sm:col-span-2">
            <span className="text-sm font-medium text-[#211815]">
              Note opzionali
            </span>
            <textarea
              className="min-h-28 rounded-[8px] border border-[#211815]/10 bg-white/55 px-3 py-2 text-sm text-[#211815] outline-none transition focus:border-[#8b5e4a]/45"
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
            />
          </label>
        </div>
        <button
          type="submit"
          className="mt-6 inline-flex w-full justify-center rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 sm:w-auto"
        >
          Prepara email
        </button>
      </form>
    </ModalFrame>
  );
}

function ModalFrame({
  labelledBy,
  closeLabel,
  onClose,
  children,
}: {
  labelledBy: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      aria-labelledby={labelledBy}
      aria-modal="true"
      className="fixed inset-0 z-[90] grid place-items-center bg-[#211815]/45 px-4 py-5 backdrop-blur-sm"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="relative max-h-[calc(100dvh-40px)] w-full max-w-2xl overflow-y-auto rounded-[8px] border border-[#211815]/10 bg-[#f4efe8] p-5 shadow-[0_24px_80px_rgba(33,24,21,0.28)] md:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label={closeLabel}
          className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full border border-[#211815]/10 bg-[#f4efe8]/85 text-xl leading-none text-[#211815] backdrop-blur-sm transition hover:bg-white"
          onClick={onClose}
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

function SectionHeader({ intro }: { intro?: string | string[] }) {
  const paragraphs = Array.isArray(intro) ? intro : intro ? [intro] : [];

  return paragraphs.length ? (
    <div className="grid max-w-3xl gap-2 text-[15px] leading-[1.7] text-[#5f524c]">
      {paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </div>
  ) : null;
}

function DetailsBlock({
  title,
  paragraphs = [],
  items,
  defaultOpen = false,
}: {
  title: string;
  paragraphs?: string[];
  items: string[];
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="rounded-[8px] border border-[#211815]/10 bg-white/35"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-[#211815] marker:hidden">
        <span>{title}</span>
        <span aria-hidden="true" className="text-[#8b5e4a]">
          +
        </span>
      </summary>
      <div className="border-t border-[#211815]/10 px-4 py-3">
        {paragraphs.length ? (
          <div className="mb-3 grid gap-2 text-sm leading-[1.6] text-[#5f524c]">
            {paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        ) : null}
        <ul className="grid gap-2 text-sm leading-[1.55] text-[#5f524c]">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden="true" className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#8b5e4a]/55" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function ProductImage({
  product,
  title,
  failedImage,
  onImageError,
  heightClassName,
}: {
  product?: ShopProduct;
  title: string;
  failedImage?: boolean;
  onImageError: (id: string) => void;
  heightClassName: string;
}) {
  if (!product?.image || failedImage) {
    return (
      <div className={`grid place-items-center bg-[#8b5e4a]/[0.08] ${heightClassName}`}>
        <p className="px-5 text-center font-serif text-2xl font-medium leading-[1.08] text-[#8b5e4a]">
          {title}
        </p>
      </div>
    );
  }

  return (
    <div className={`relative bg-[#efe4d7] ${heightClassName}`}>
      <Image
        src={product.image}
        alt={title}
        fill
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        className="object-cover"
        onError={() => onImageError(product.id)}
      />
    </div>
  );
}

function BuyButton({ storeUrl }: { storeUrl?: string }) {
  const { dictionary } = useLanguage();
  const shopDict = dictionary.shop;

  if (!storeUrl) {
    return (
      <p className="mt-3 rounded-[8px] border border-[#211815]/10 bg-white/45 px-4 py-3 text-sm leading-[1.6] text-[#5f524c]">
        {shopDict.shopComingSoon}
      </p>
    );
  }

  return (
    <a
      href={storeUrl}
      target="_blank"
      rel="noreferrer"
      className="mt-3 inline-flex w-full justify-center rounded-full bg-[#211815] px-4 py-2.5 text-sm font-medium text-white transition hover:-translate-y-0.5"
    >
      {shopDict.buy}
    </a>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-[#211815]/15 bg-white/30 p-5 text-sm leading-[1.7] text-[#5f524c]">
      {text}
    </div>
  );
}

function Chip({
  children,
  strong = false,
}: {
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <span
      className={`rounded-full border border-[#211815]/10 px-3 py-1.5 ${
        strong
          ? "bg-[#f4efe8]/80 font-medium text-[#211815]"
          : "bg-white/45 text-[#5f524c]"
      }`}
    >
      {children}
    </span>
  );
}


function UseChip({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
        active
          ? "border-[#8b5e4a]/20 bg-[#8b5e4a]/[0.08] text-[#8b5e4a]"
          : "border-[#211815]/10 bg-white/45 text-[#5f524c]/55"
      }`}
    >
      {label}: {active ? "sì" : "no"}
    </span>
  );
}

function TextInput({
  label,
  value,
  onChange,
  required = false,
  placeholder,
  type = "text",
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
  min?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-[#211815]">{label}</span>
      <input
        required={required}
        type={type}
        min={min}
        value={value}
        placeholder={placeholder}
        className="rounded-[8px] border border-[#211815]/10 bg-white/55 px-3 py-2 text-sm text-[#211815] outline-none transition focus:border-[#8b5e4a]/45"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-[#211815]">{label}</span>
      <select
        value={value}
        className="rounded-[8px] border border-[#211815]/10 bg-white/55 px-3 py-2 text-sm text-[#211815] outline-none transition focus:border-[#8b5e4a]/45"
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function getCardQuizResult(answers: number[]): CardLevel {
  const scores: Record<CardLevel, number> = {
    Bronze: 0,
    Silver: 0,
    Gold: 0,
    Platinum: 0,
  };

  answers.forEach((answerIndex, questionIndex) => {
    const option = CARD_QUIZ[questionIndex]?.options[answerIndex];
    if (!option) {
      return;
    }

    Object.entries(option.scores).forEach(([level, score]) => {
      scores[level as CardLevel] += score ?? 0;
    });
  });

  const priority: CardLevel[] = ["Bronze", "Silver", "Gold", "Platinum"];
  return priority.reduce((best, level) =>
    scores[level] > scores[best] ? level : best,
  );
}

function findProductByVariant(products: ShopProduct[], variant: string) {
  return products.find(
    (product) => normalizeText(product.variant ?? "") === normalizeText(variant),
  );
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function useModalLock(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);
}
