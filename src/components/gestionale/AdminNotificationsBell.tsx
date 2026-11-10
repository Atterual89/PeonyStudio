"use client";

import { Bell, BellRing, CheckCheck, Smartphone, X } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getAdminPushKeyAction, listAdminNotificationsAction,
  markAdminNotificationReadAction, markAllAdminNotificationsReadAction,
  removeAdminPushSubscriptionAction, saveAdminPushSubscriptionAction,
  testAdminPushAction, type AdminNotification,
} from "@/app/gestione/(app)/notifications/actions";

function formatWhen(value: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome",
  }).format(new Date(value));
}
function base64urlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const data = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(data.length));
  for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i);
  return bytes;
}
function errorText(value: unknown): string {
  return value instanceof Error ? value.message : "Operazione non riuscita.";
}

/** Campanella comune a tutte le pagine admin; le letture sono per operatore. */
export function AdminNotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [vapidKey, setVapidKey] = useState<string | null>(null);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushActive, setPushActive] = useState(false);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    try {
      const data = await listAdminNotificationsAction();
      setItems(data.items); setUnread(data.unread);
      setError("");
    } catch (e) { setError(errorText(e)); }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 30000);
    const supported = "serviceWorker" in navigator &&
      "PushManager" in window && "Notification" in window && window.isSecureContext;
    setPushSupported(supported);
    if (supported) {
      void getAdminPushKeyAction().then(setVapidKey).catch(() => setVapidKey(null));
      void navigator.serviceWorker.getRegistration("/gestione/").then(async reg => {
        const subscription = await reg?.pushManager.getSubscription();
        setPushActive(Boolean(subscription));
      }).catch(() => undefined);
    }
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "peony-new-notification") void refresh();
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      window.clearInterval(timer);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [refresh]);

  async function enablePush() {
    setError(""); setMessage("");
    if (!vapidKey || !pushSupported) { setError("Le push non sono disponibili su questo dispositivo."); return; }
    // Il permesso va richiesto direttamente dopo il gesto dell'utente.
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") {
      setError("Autorizza le notifiche nelle impostazioni del browser."); return;
    }
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.register("/gestione-push-sw.js", { scope: "/gestione/" });
        const subscription = await registration.pushManager.getSubscription() ||
          await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64urlToBytes(vapidKey) });
        await saveAdminPushSubscriptionAction(subscription.toJSON());
        setPushActive(true);
        setMessage("Notifiche push attivate su questo dispositivo.");
      } catch (e) { setError(errorText(e)); }
    });
  }

  function disablePush() {
    setError(""); setMessage("");
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration("/gestione/");
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          await removeAdminPushSubscriptionAction(subscription.endpoint);
          await subscription.unsubscribe();
        }
        setPushActive(false);
        setMessage("Notifiche push disattivate su questo dispositivo.");
      } catch (e) { setError(errorText(e)); }
    });
  }

  function testPush() {
    setError(""); setMessage("");
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration("/gestione/");
        const subscription = await registration?.pushManager.getSubscription();
        const sent = subscription ? await testAdminPushAction(subscription.endpoint) : false;
        if (!sent) throw new Error("Push di prova non consegnata al servizio del browser.");
        setMessage("Push di prova inviata. Verifica la notifica sul telefono.");
      } catch (e) { setError(errorText(e)); }
    });
  }

  function markRead(item: AdminNotification) {
    startTransition(async () => {
      try {
        await markAdminNotificationReadAction(item.id);
        setOpen(false);
        router.push(item.href);
        void refresh();
      } catch (e) { setError(errorText(e)); }
    });
  }
  function markAllRead() {
    startTransition(async () => {
      try { await markAllAdminNotificationsReadAction(); await refresh(); }
      catch (e) { setError(errorText(e)); }
    });
  }

  return <div className="relative" aria-label="Notifiche admin">
    <button type="button" onClick={() => { setOpen(!open); if (!open) void refresh(); }}
      aria-label={unread ? `Notifiche: ${unread} non lette` : "Apri notifiche"}
      aria-expanded={open}
      className="relative flex min-h-10 items-center gap-2 rounded-xl border border-[#211815]/15 bg-white px-3 py-2 text-sm font-semibold text-[#211815]">
      {unread ? <BellRing aria-hidden="true" className="h-5 w-5 text-[#a8583e]"/> : <Bell aria-hidden="true" className="h-5 w-5"/>}
      <span>Notifiche</span>
      {unread > 0 && <span className="rounded-full bg-[#a8583e] px-1.5 py-0.5 text-xs font-bold text-white" aria-label={`${unread} non lette`}>
        {unread > 99 ? "99+" : unread}
      </span>}
    </button>
    {open && <div className="absolute right-0 top-12 z-[60] w-[min(92vw,390px)] overflow-hidden rounded-xl border border-[#211815]/15 bg-[#fbf8f3] shadow-xl" role="region" aria-label="Elenco notifiche">
      <div className="flex items-center justify-between gap-2 border-b border-[#211815]/10 p-3">
        <p className="font-semibold">Notifiche {unread ? `· ${unread} nuove` : ""}</p>
        <button type="button" aria-label="Chiudi notifiche" onClick={() => setOpen(false)}><X className="h-5 w-5"/></button>
      </div>
      {unread > 0 && <div className="border-b border-[#211815]/10 px-3 py-2 text-right">
        <button type="button" disabled={pending} onClick={markAllRead}
          className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-[#a8583e]">
          <CheckCheck className="h-4 w-4"/> Segna tutte come lette
        </button>
      </div>}
      <div className="max-h-[45vh] overflow-y-auto">
        {items.length ? items.map(item => <button key={item.id} type="button" disabled={pending}
          onClick={() => markRead(item)}
          className={`block w-full border-b border-[#211815]/10 px-3 py-3 text-left last:border-0 hover:bg-[#f2ede3] ${item.readAt ? "opacity-65" : "bg-white"}`}>
          <span className="flex items-center gap-2 text-sm font-semibold">
            {!item.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-[#a8583e]"/>}
            {item.title}
          </span>
          <span className="mt-1 block break-words text-sm text-[#5f524c]">{item.body}</span>
          <span className="mt-1 block text-xs text-[#786961]">{formatWhen(item.createdAt)}</span>
        </button>) : <p className="p-4 text-sm text-[#5f524c]">Nessuna notifica.</p>}
      </div>
      <div className="space-y-2 border-t border-[#211815]/10 p-3 text-sm">
        <p className="flex items-center gap-2 font-semibold"><Smartphone className="h-4 w-4"/> Notifiche sul telefono</p>
        {!pushSupported ? <p className="text-xs text-[#5f524c]">Browser o connessione HTTPS non compatibili.</p> :
          !vapidKey ? <p className="text-xs text-[#5f524c]">Push da configurare sul server.</p> :
          <div className="flex flex-wrap gap-2">
            {pushActive ? <>
              <button type="button" disabled={pending} onClick={disablePush}
                className="min-h-9 rounded-lg border border-[#211815]/20 px-3 text-xs">Disattiva</button>
              <button type="button" disabled={pending} onClick={testPush}
                className="min-h-9 rounded-lg border border-[#211815]/20 px-3 text-xs">Prova push</button>
            </> : <button type="button" disabled={pending} onClick={() => { void enablePush(); }}
              className="min-h-9 rounded-lg bg-[#a8583e] px-3 text-xs font-semibold text-white">Attiva push</button>}
          </div>}
        {message && <p role="status" className="text-xs text-[#326941]">{message}</p>}
        {error && <p role="alert" className="text-xs text-[#9b2c2c]">{error}</p>}
        <p className="text-xs text-[#786961]">Ogni admin gestisce le proprie notifiche e i propri dispositivi.</p>
      </div>
    </div>}
  </div>;
}
