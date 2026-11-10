"use server";

import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import {
  publicVapidKey, pushConfigured, sendWebPush, validPushSubscription,
  type PushSubscriptionRecord,
} from "@/lib/gestionale/server/admin-push";
import { isUuidLike } from "@/lib/gestionale/validation";

export type AdminNotification = {
  id: string;
  kind: "ale_booking" | "ale_contact";
  title: string;
  body: string;
  href: string;
  createdAt: string;
  readAt: string | null;
};

export async function listAdminNotificationsAction(): Promise<{
  items: AdminNotification[];
  unread: number;
}> {
  const operator = await requireAdmin();
  const db = getGestionaleDb();
  const [{ data, error }, { count, error: countError }] = await Promise.all([
    db.from("gw_admin_notifications")
      .select("id,kind,title,body,href,created_at,read_at")
      .eq("recipient_operator_id", operator.id)
      .order("created_at", { ascending: false }).limit(60),
    db.from("gw_admin_notifications").select("id", { count: "exact", head: true })
      .eq("recipient_operator_id", operator.id).is("read_at", null),
  ]);
  if (error || countError) throw new Error("Notifiche non disponibili.");
  return {
    items: (data ?? []).map(n => ({
      id: n.id, kind: n.kind, title: n.title, body: n.body, href: n.href,
      createdAt: n.created_at, readAt: n.read_at,
    })),
    unread: count ?? 0,
  };
}

export async function markAdminNotificationReadAction(id: string): Promise<void> {
  const operator = await requireAdmin();
  if (!isUuidLike(id)) throw new Error("Notifica non valida.");
  const { error } = await getGestionaleDb().from("gw_admin_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id).eq("recipient_operator_id", operator.id).is("read_at", null);
  if (error) throw new Error("Impossibile segnare la notifica come letta.");
}

export async function markAllAdminNotificationsReadAction(): Promise<void> {
  const operator = await requireAdmin();
  const { error } = await getGestionaleDb().from("gw_admin_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_operator_id", operator.id).is("read_at", null);
  if (error) throw new Error("Impossibile aggiornare le notifiche.");
}

export async function getAdminPushKeyAction(): Promise<string | null> {
  await requireAdmin();
  return pushConfigured() ? publicVapidKey() : null;
}

export async function saveAdminPushSubscriptionAction(value: unknown): Promise<void> {
  const operator = await requireAdmin();
  if (!pushConfigured()) throw new Error("Push non configurate sul server.");
  if (!validPushSubscription(value)) throw new Error("Sottoscrizione push non valida.");
  const { endpoint, keys } = value;
  const { error } = await getGestionaleDb().from("gw_admin_push_subscriptions")
    .upsert({
      operator_id: operator.id,
      endpoint, p256dh: keys.p256dh, auth: keys.auth,
      updated_at: new Date().toISOString(),
    }, { onConflict: "endpoint" });
  if (error) throw new Error("Impossibile attivare le notifiche su questo dispositivo.");
}

export async function removeAdminPushSubscriptionAction(endpoint: string): Promise<void> {
  const operator = await requireAdmin();
  if (typeof endpoint !== "string" || endpoint.length > 2048) return;
  const { error } = await getGestionaleDb().from("gw_admin_push_subscriptions")
    .delete().eq("operator_id", operator.id).eq("endpoint", endpoint);
  if (error) throw new Error("Impossibile disattivare le push.");
}

export async function testAdminPushAction(endpoint: string): Promise<boolean> {
  const operator = await requireAdmin();
  if (!pushConfigured() || typeof endpoint !== "string") return false;
  const { data } = await getGestionaleDb().from("gw_admin_push_subscriptions")
    .select("operator_id,endpoint,p256dh,auth").eq("operator_id", operator.id)
    .eq("endpoint", endpoint).maybeSingle();
  if (!data) return false;
  const result = await sendWebPush(data as PushSubscriptionRecord, {
    title: "Notifiche Peony attive",
    body: "Questo dispositivo riceverà gli avvisi delle nuove iscrizioni di Ale.",
    url: "/gestione", tag: "peony-push-test",
  });
  return result === "ok";
}
