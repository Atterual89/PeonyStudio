"use client";

import { useState } from "react";

import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  label: string;
  size?: number;
  className?: string;
};

export function IconTooltip({ icon: Icon, label, size = 14, className = "text-[#8b5e4a]/65" }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="relative inline-flex items-center justify-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onClick={() => setVisible((v) => !v)}
      onBlur={() => setVisible(false)}
      tabIndex={0}
      role="img"
      aria-label={label}
    >
      <Icon size={size} className={className} aria-hidden="true" />
      {visible ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-[6px] bg-[#211815] px-2.5 py-1.5 text-[10px] font-medium leading-none text-[#f4efe8] shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
        >
          {label}
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[4px] border-t-[4px] border-x-transparent border-t-[#211815]"
          />
        </span>
      ) : null}
    </span>
  );
}
