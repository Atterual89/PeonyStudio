/** Conta quote distinte; un salvataggio può comparire sia nella risposta
 * immediata dell'azione sia nel successivo caricamento dal database. */
export function countAssignedPaymentSlots(
  persisted:readonly number[],
  recent:readonly {slot:number}[],
):number{
  return new Set<number>([...persisted,...recent.map(item=>item.slot)]).size;
}
