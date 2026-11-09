/** Ticket Tailor stores the actual purchase time as a Unix epoch in raw_payload.created_at.
 * The database created_at is an import timestamp and must NOT determine order.
 */
export function ticketTailorCreatedAt(payload: unknown): number | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = (payload as {created_at?: unknown}).created_at;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const n=Number(raw);
    if (!Number.isFinite(n)||n<=0)return null;
    const ms=n<100_000_000_000?n*1000:n;
    return Number.isFinite(ms) ? ms : null;
  }
  const parsed=Date.parse(raw);
  return Number.isFinite(parsed)?parsed:null;
}

export function compareTicketChronology(
  a:{time:number|null;id:string}, b:{time:number|null;id:string},
):number {
  // Older purchase first, unknown purchase timestamps last.
  if (a.time===null && b.time!==null) return 1;
  if (b.time===null && a.time!==null) return -1;
  if (a.time!==null && b.time!==null && a.time!==b.time) return a.time-b.time;
  return a.id.localeCompare(b.id);
}
