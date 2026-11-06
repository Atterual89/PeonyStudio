// Persona scelta nell'aggiunta rapida o nel cambio partner. Arriva dal
// browser: va sempre validata sul server con parsePersonChoice.

import { parseMemberKey } from "./member-key";
import type { MembershipBadge } from "./types";
import { isUuidLike } from "./validation";

/** `detail` e `badge` servono solo alla visualizzazione: il server li ignora. */
type ChoiceDisplay = { label: string; detail?: string; badge?: MembershipBadge };

export type PersonChoice =
  | ({ kind: "existing"; id: string } & ChoiceDisplay)
  /** memberId: chiave del socio (member-key.ts). */
  | ({ kind: "member"; memberId: string } & ChoiceDisplay)
  | ({ kind: "new"; text: string } & ChoiceDisplay);

export function parsePersonChoice(value: unknown): PersonChoice | null {
  if (!value || typeof value !== "object") return null;
  const choice = value as Record<string, unknown>;
  const label = typeof choice.label === "string" ? choice.label.slice(0, 200) : "";

  if (choice.kind === "existing" && isUuidLike(choice.id)) {
    return { kind: "existing", id: choice.id, label };
  }
  if (choice.kind === "member" && typeof choice.memberId === "string" && parseMemberKey(choice.memberId)) {
    return { kind: "member", memberId: choice.memberId, label };
  }
  if (choice.kind === "new" && typeof choice.text === "string") {
    const text = choice.text.trim().replace(/\s+/g, " ").slice(0, 120);
    return text ? { kind: "new", text, label: text } : null;
  }
  return null;
}
