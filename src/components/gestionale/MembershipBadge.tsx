import { membershipLabel } from "@/lib/gestionale/membership-rule";
import type { MembershipBadge as Badge } from "@/lib/gestionale/types";

const STYLES: Record<Badge["kind"], string> = {
  in_regola: "bg-[#eaf3ec] text-[#2f5d3b] border-[#3f7a4f]/30",
  quota_mancante: "bg-[#fdf3e1] text-[#7a5212] border-[#b7791f]/30",
  modulo_mancante: "bg-[#fbeaea] text-[#7a2222] border-[#9b2c2c]/30",
  non_collegata: "bg-[#211815]/5 text-[#5f524c] border-[#211815]/15",
};

export function MembershipBadge({ badge }: { badge: Badge }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STYLES[badge.kind]}`}>
      {membershipLabel(badge)}
    </span>
  );
}
