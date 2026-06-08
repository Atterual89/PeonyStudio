import Image from "next/image";

type EventImageVariant = "card" | "hero" | "compact" | "mobile";

type EventImageProps = {
  src: string;
  alt: string;
  variant?: EventImageVariant;
  className?: string;
  priority?: boolean;
};

const variantClasses: Record<EventImageVariant, string> = {
  card: "aspect-[16/10]",
  hero: "aspect-[16/9]",
  compact: "aspect-square",
  mobile: "aspect-[10/11]",
};

const imageClasses: Record<EventImageVariant, string> = {
  card: "object-contain p-2",
  hero: "object-cover",
  compact: "object-contain p-1.5",
  mobile: "object-contain p-2",
};

const sizes: Record<EventImageVariant, string> = {
  card: "(min-width: 768px) 300px, 74vw",
  hero: "(min-width: 1024px) 640px, 90vw",
  compact: "72px",
  mobile: "200px",
};

export function EventImage({
  src,
  alt,
  variant = "card",
  className = "",
  priority = false,
}: EventImageProps) {
  return (
    <div
      className={`relative overflow-hidden bg-[#efe4d7] ${variantClasses[variant]} ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes[variant]}
        priority={priority}
        className={`${imageClasses[variant]} saturate-[0.92] transition duration-700`}
      />
    </div>
  );
}
