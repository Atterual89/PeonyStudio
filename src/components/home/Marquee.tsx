"use client";

const items = [
  "Programmi",
  "Pratica",
  "Community",
  "Workshop",
  "Exploration",
  "Cultura",
  "Shop",
];

export function Marquee() {
  const text = ` ${items.join(" · ")} · `;

  return (
    <div className="overflow-hidden border-y border-[#211815]/10 bg-white/40 py-3.5">
      <div className="flex w-max animate-[marquee_32s_linear_infinite] whitespace-nowrap">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="shrink-0 font-serif text-[15px] italic tracking-normal text-[#8b5e4a] opacity-70"
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
