"use client";

// Eliminazioni (Fase 4b, D22): conferma sul posto, mai finestre del browser;
// dopo l'eliminazione "Eliminato · Annulla" per almeno 30 secondi e finché non
// si tocca altro (4g, #18), poi niente cestino. Il messaggio vive nel layout,
// così resta anche se la riga sparisce o si cambia pagina; se c'è un
// segnaposto (UndoSlot) per quell'eliminazione compare lì, vicino alla riga.

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, useTransition } from "react";

import {
  deleteBookingAction,
  deleteBookingWithPaymentsAction,
  deletePaymentAction,
  deletePersonAction,
  deleteWorkshopAction,
  restoreDeletedAction,
} from "@/app/gestione/(app)/delete-actions";
import {
  DELETE_HINTS,
  UNDO_MAX_SECONDS,
  bookingDeleteBlock,
  bookingWithPaymentsLabel,
  paymentDeleteQuestion,
  undoShouldHide,
  workshopNameMatches,
} from "@/lib/gestionale/deletions";
import { paidCents } from "@/lib/gestionale/payments";
import type { CurrentPayment } from "@/lib/gestionale/payments";
import type { ActionResult, Payment } from "@/lib/gestionale/types";

import { Notice, buttonClass, inputClass } from "./ui";

/** `scope`: segnaposto (UndoSlot) vicino alla riga in cui mostrare il messaggio. */
type Deleted = { entity: string; id: string; afterUndo?: () => void; scope?: string };
type UndoState = Deleted & { key: number; shownAt: number; phase: "idle" | "pending" | "restored" | "error"; error?: string };

type UndoApi = {
  show: (deleted: Deleted) => void;
  state: UndoState | null;
  undo: () => void;
  register: (scope: string) => () => void;
};

const UndoContext = createContext<UndoApi>({ show: () => {}, state: null, undo: () => {}, register: () => () => {} });

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UndoState | null>(null);
  const [slots, setSlots] = useState<Record<string, number>>({});
  const [, startTransition] = useTransition();

  const show = useCallback((deleted: Deleted) => {
    const now = Date.now();
    setState({ ...deleted, key: now, shownAt: now, phase: "idle" });
  }, []);

  const register = useCallback((scope: string) => {
    setSlots((current) => ({ ...current, [scope]: (current[scope] ?? 0) + 1 }));
    return () => setSlots((current) => ({ ...current, [scope]: Math.max(0, (current[scope] ?? 1) - 1) }));
  }, []);

  useEffect(() => {
    if (!state || state.phase === "pending") return;
    if (state.phase !== "idle") {
      const timer = setTimeout(() => setState(null), 4000);
      return () => clearTimeout(timer);
    }
    // 4g (#18): dopo 30 secondi sparisce al primo tocco altrove; dopo 10 minuti comunque.
    const hideIf = (touched: boolean) => {
      if (undoShouldHide((Date.now() - state.shownAt) / 1000, touched)) setState(null);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-undo-notice]")) return;
      hideIf(true);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    const timer = setTimeout(() => hideIf(false), UNDO_MAX_SECONDS * 1000);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      clearTimeout(timer);
    };
  }, [state]);

  const undo = useCallback(() => {
    if (!state || state.phase !== "idle") return;
    const current = state;
    setState({ ...current, phase: "pending" });
    startTransition(async () => {
      const result = await restoreDeletedAction({ entity: current.entity, id: current.id });
      if (result.ok) {
        setState({ ...current, phase: "restored" });
        current.afterUndo?.();
      } else {
        setState({ ...current, phase: "error", error: result.error });
      }
    });
  }, [state]);

  // Senza un segnaposto montato per quell'eliminazione, il messaggio sta in basso.
  const floating = state !== null && !(state.scope && (slots[state.scope] ?? 0) > 0);

  return (
    <UndoContext.Provider value={{ show, state, undo, register }}>
      {children}
      {state && floating ? (
        <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
          <UndoMessage state={state} undo={undo} />
        </div>
      ) : null}
    </UndoContext.Provider>
  );
}

function UndoMessage({ state, undo }: { state: UndoState; undo: () => void }) {
  return (
    <div
      key={state.key}
      role="status"
      data-undo-notice
      className="flex min-h-10 w-fit items-center gap-3 rounded-xl bg-[#211815] px-4 py-2 text-sm font-medium text-white shadow-lg"
    >
      {state.phase === "error" ? (
        <span>{state.error}</span>
      ) : state.phase === "restored" ? (
        <span>Ripristinato.</span>
      ) : (
        <>
          <span>Eliminato</span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={undo}
            disabled={state.phase === "pending"}
            className="min-h-10 font-semibold text-[#f2ede3] underline disabled:opacity-60"
          >
            {state.phase === "pending" ? "Ripristino…" : "Annulla"}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * 4g (#18): segnaposto vicino alla riga eliminata. Il messaggio "Eliminato ·
 * Annulla" delle eliminazioni con lo stesso `scope` compare qui invece che in
 * basso.
 */
export function UndoSlot({ scope }: { scope: string }) {
  const { state, undo, register } = useContext(UndoContext);
  useEffect(() => register(scope), [register, scope]);
  if (!state || state.scope !== scope) return null;
  return <UndoMessage state={state} undo={undo} />;
}

/**
 * Conferma sul posto: "Eliminare <cosa>? · Elimina · Annulla". Il fuoco va su
 * Annulla: niente eliminazioni con un solo tocco, nemmeno da tastiera.
 * `confirmName`: per confermare si scrive questo testo (workshop).
 */
export function DeleteConfirm({
  question,
  note,
  hint,
  confirmLabel = "Elimina",
  confirmName,
  entity,
  id,
  remove,
  onClose,
  onDeleted,
  afterUndo,
  undoScope,
}: {
  question: string;
  note?: string;
  hint: string;
  confirmLabel?: string;
  confirmName?: { label: string; matches: (typed: string) => boolean };
  entity: string;
  id: string;
  /** Riceve il testo scritto per confermare (solo con `confirmName`). */
  remove: (typed: string) => Promise<ActionResult>;
  onClose: () => void;
  onDeleted?: () => void;
  afterUndo?: () => void;
  /** 4g (#18): segnaposto (UndoSlot) in cui mostrare "Eliminato · Annulla". */
  undoScope?: string;
}) {
  const { show: showUndo } = useContext(UndoContext);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const blocked = confirmName ? !confirmName.matches(typed) : false;

  function confirm() {
    if (blocked) return;
    setError(null);
    startTransition(async () => {
      const result = await remove(typed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      showUndo({ entity, id, afterUndo, scope: undoScope });
      onClose();
      onDeleted?.();
    });
  }

  return (
    <div className="space-y-2 rounded-xl border border-[#9b2c2c]/30 bg-[#fbeaea]/60 p-3 text-sm">
      <p className="font-semibold text-[#211815]">{question}</p>
      {note ? <p>{note}</p> : null}
      <p className="text-[#5f524c]">{hint}</p>
      {confirmName ? (
        <label className="block">
          <span className="mb-1 block font-medium text-[#5f524c]">{confirmName.label}</span>
          <input className={inputClass} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </label>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass.danger} onClick={confirm} disabled={pending || blocked}>
          {pending ? "Eliminazione…" : confirmLabel}
        </button>
        <button type="button" className={buttonClass.ghost} onClick={onClose} disabled={pending} autoFocus>
          Chiudi
        </button>
      </div>
    </div>
  );
}

/** Pagamento: conferma sempre obbligatoria, con i dettagli del movimento (valore attuale). */
export function DeletePaymentConfirm({
  entry,
  name,
  onClose,
  undoScope,
}: {
  entry: CurrentPayment;
  name: string;
  onClose: () => void;
  undoScope?: string;
}) {
  const { payment } = entry;
  return (
    <DeleteConfirm
      question={paymentDeleteQuestion(payment, entry.amountCents, name)}
      note={entry.modified ? "Non conterà più nei totali, insieme alle sue correzioni." : "Non conterà più nei totali."}
      hint={DELETE_HINTS.payment}
      confirmLabel={payment.kind === "pagamento" ? "Elimina pagamento" : "Elimina"}
      entity="payment"
      id={payment.id}
      remove={() => deletePaymentAction({ paymentId: payment.id })}
      onClose={onClose}
      undoScope={undoScope}
    />
  );
}

/**
 * Iscrizione: senza soldi si elimina con la conferma solita. Con dei pagamenti
 * (4e, #21) il messaggio spiega e offre "Elimina anche i pagamenti (X €) e
 * l'iscrizione": una sola conferma, un solo Annulla.
 */
export function DeleteBookingConfirm({
  booking,
  name,
  onClose,
  undoScope,
}: {
  booking: { bookingId: string; version: number; payments: readonly Payment[] };
  name: string;
  onClose: () => void;
  undoScope?: string;
}) {
  const block = bookingDeleteBlock(booking.payments);
  if (block) {
    const paid = paidCents(booking.payments);
    return (
      <DeleteConfirm
        question={`Eliminare l'iscrizione di ${name}?`}
        note={`${block} Se è stata inserita per errore, puoi eliminare tutto insieme.`}
        hint={DELETE_HINTS.booking}
        confirmLabel={bookingWithPaymentsLabel(booking.payments)}
        entity="booking"
        id={booking.bookingId}
        remove={() => deleteBookingWithPaymentsAction({ bookingId: booking.bookingId, version: booking.version, expectedCents: paid })}
        onClose={onClose}
        undoScope={undoScope}
      />
    );
  }
  return (
    <DeleteConfirm
      question={`Eliminare l'iscrizione di ${name}?`}
      hint={DELETE_HINTS.booking}
      entity="booking"
      id={booking.bookingId}
      remove={() => deleteBookingAction({ bookingId: booking.bookingId, version: booking.version })}
      onClose={onClose}
      undoScope={undoScope}
    />
  );
}

/** In fondo alla scheda persona (solo admin): "Elimina persona". */
export function DeletePersonSection({ person }: { person: { id: string; version: number; name: string } }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  return (
    <div className="mt-6 border-t border-[#211815]/10 pt-4">
      {asking ? (
        <DeleteConfirm
          question={`Eliminare la persona ${person.name}?`}
          note="Si può eliminare solo se non ha iscrizioni."
          hint={DELETE_HINTS.generic}
          entity="person"
          id={person.id}
          remove={() => deletePersonAction({ personId: person.id, version: person.version })}
          onClose={() => setAsking(false)}
          onDeleted={() => router.push("/gestione/persone")}
          afterUndo={() => router.push(`/gestione/p/${person.id}`)}
        />
      ) : (
        <button type="button" className={buttonClass.danger} onClick={() => setAsking(true)}>
          Elimina persona
        </button>
      )}
    </div>
  );
}

/** In fondo al tab Info (solo admin, workshop non collegato a Ticket Tailor): "Elimina workshop". */
export function DeleteWorkshopSection({ workshop }: { workshop: { id: string; version: number; name: string } }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  return (
    <div className="border-t border-[#211815]/10 pt-4">
      {asking ? (
        <DeleteConfirm
          question={`Eliminare il workshop ${workshop.name}?`}
          note="Si eliminano anche tutto ciò che contiene: iscrizioni, pagamenti, spese, trasferimenti e riporti."
          hint={DELETE_HINTS.generic}
          confirmName={{ label: "Per confermare scrivi il nome del workshop", matches: (typed) => workshopNameMatches(typed, workshop.name) }}
          entity="workshop"
          id={workshop.id}
          remove={(typed) => deleteWorkshopAction({ workshopId: workshop.id, version: workshop.version, confirmName: typed })}
          onClose={() => setAsking(false)}
          onDeleted={() => router.push("/gestione")}
          afterUndo={() => router.push(`/gestione/w/${workshop.id}?tab=info`)}
        />
      ) : (
        <button type="button" className={buttonClass.danger} onClick={() => setAsking(true)}>
          Elimina workshop
        </button>
      )}
    </div>
  );
}
