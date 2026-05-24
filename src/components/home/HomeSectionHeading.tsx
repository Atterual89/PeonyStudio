type HomeSectionHeadingProps = {
  eyebrow?: string;
  title: string;
  intro?: string;
};

export function HomeSectionHeading({
  eyebrow,
  title,
  intro,
}: HomeSectionHeadingProps) {
  return (
    <div className="max-w-2xl">
      {eyebrow ? (
        <p className="mb-4 text-sm uppercase tracking-[0.25em] text-[#8b5e4a]">
          {eyebrow}
        </p>
      ) : null}

      <h2 className="text-3xl font-semibold leading-tight md:text-5xl">
        {title}
      </h2>

      {intro ? (
        <p className="mt-5 text-base leading-7 text-[#5f524c] md:text-lg">
          {intro}
        </p>
      ) : null}
    </div>
  );
}
