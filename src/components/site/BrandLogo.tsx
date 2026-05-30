import Image from "next/image";

type BrandLogoProps = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <Image
        src="/brand/peony-logo.png"
        alt=""
        width={compact ? 28 : 36}
        height={compact ? 28 : 36}
        className="h-7 w-7 object-contain sm:h-8 sm:w-8"
      />
      <span className="font-serif text-lg font-medium tracking-[0.08em] text-[#211815]">
        PEONY
      </span>
    </span>
  );
}
