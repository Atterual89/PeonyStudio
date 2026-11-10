import "server-only";

import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign } from "node:crypto";
import { getGestionaleDb } from "@/lib/gestionale/server/db";

/**
 * Web Push senza dipendenze: VAPID RFC 8292 + aes128gcm RFC 8291/8188.
 * Le chiavi private restano sul server Netlify; il browser riceve solo la public key.
 */
export type PushKeys = { p256dh: string; auth: string };
export type PushSubscriptionRecord = PushKeys & { endpoint: string; operator_id: string };

export function publicVapidKey(): string | null {
  return process.env.GW_VAPID_PUBLIC_KEY?.trim() || null;
}
function privateVapidKey(): string | null {
  return process.env.GW_VAPID_PRIVATE_KEY?.trim() || null;
}
export function pushConfigured(): boolean {
  return Boolean(publicVapidKey() && privateVapidKey());
}

function knownPushEndpoint(endpoint: string): URL | null {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return null;
    const host = url.hostname.toLowerCase();
    // Evita SSRF: gli URL vengono forniti dal browser dell'admin.
    const allowed = host === "fcm.googleapis.com" ||
      host === "updates.push.services.mozilla.com" ||
      host === "push.services.mozilla.com" ||
      host === "web.push.apple.com" ||
      host.endsWith(".push.apple.com") ||
      host.endsWith(".notify.windows.com");
    return allowed ? url : null;
  } catch { return null; }
}

export function validPushSubscription(value: unknown): value is { endpoint: string; keys: PushKeys } {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.endpoint !== "string" || v.endpoint.length > 2048 || !knownPushEndpoint(v.endpoint)) return false;
  if (!v.keys || typeof v.keys !== "object") return false;
  const keys = v.keys as Record<string, unknown>;
  if (typeof keys.p256dh !== "string" || typeof keys.auth !== "string") return false;
  if (!/^[A-Za-z0-9_-]+$/.test(keys.p256dh) || !/^[A-Za-z0-9_-]+$/.test(keys.auth)) return false;
  try {
    const p = Buffer.from(keys.p256dh, "base64url");
    return p.length === 65 && p[0] === 4 && Buffer.from(keys.auth, "base64url").length === 16;
  } catch { return false; }
}

function hmac(key: Buffer, message: Buffer): Buffer {
  return createHmac("sha256", key).update(message).digest();
}
function expand(prk: Buffer, info: Buffer, length: number): Buffer {
  return hmac(prk, Buffer.concat([info, Buffer.from([1])])).subarray(0, length);
}
function encryptPayload(payload: string, keys: PushKeys): Buffer {
  const uaPublic = Buffer.from(keys.p256dh, "base64url");
  const auth = Buffer.from(keys.auth, "base64url");
  const server = createECDH("prime256v1");
  server.generateKeys();
  const serverPublic = server.getPublicKey(undefined, "uncompressed");
  const secret = server.computeSecret(uaPublic);
  const salt = randomBytes(16);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, serverPublic]);
  const ikm = expand(hmac(auth, secret), keyInfo, 32);
  const prk = hmac(salt, ikm);
  const cek = expand(prk, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = expand(prk, Buffer.from("Content-Encoding: nonce\0"), 12);
  const plain = Buffer.concat([Buffer.from(payload, "utf8"), Buffer.from([2])]);
  if (plain.length + 16 > 4096) throw new Error("Payload push troppo grande");
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096);
  return Buffer.concat([salt, recordSize, Buffer.from([serverPublic.length]), serverPublic, encrypted]);
}
function vapidAuthorization(audience: string): string {
  const publicKey = Buffer.from(publicVapidKey()!, "base64url");
  const privateKey = Buffer.from(privateVapidKey()!, "base64url");
  if (publicKey.length !== 65 || publicKey[0] !== 4 || privateKey.length !== 32) {
    throw new Error("Chiavi VAPID non valide");
  }
  const key = createPrivateKey({ format: "jwk", key: {
    kty: "EC", crv: "P-256",
    x: publicKey.subarray(1, 33).toString("base64url"),
    y: publicKey.subarray(33, 65).toString("base64url"),
    d: privateKey.toString("base64url"),
  } });
  const encoded = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const input = encoded({ typ: "JWT", alg: "ES256" }) + "." +
    encoded({ aud: audience, exp: Math.floor(Date.now() / 1000) + 3600,
      sub: process.env.GW_VAPID_SUBJECT || "mailto:peony.studio.turin@gmail.com" });
  const signature = sign("sha256", Buffer.from(input), { key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `vapid t=${input}.${signature}, k=${publicVapidKey()}`;
}

type PushOutcome = "ok" | "expired" | "failed";
export async function sendWebPush(subscription: PushSubscriptionRecord, payload: object): Promise<PushOutcome> {
  const endpoint = knownPushEndpoint(subscription.endpoint);
  if (!endpoint || !pushConfigured()) return "failed";
  try {
    const body = encryptPayload(JSON.stringify(payload), subscription);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": vapidAuthorization(endpoint.origin),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        "TTL": "86400",
        "Urgency": "normal",
      },
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (response.ok) return "ok";
    if (response.status === 404 || response.status === 410) return "expired";
    console.error("[gestionale] Web Push rifiutata:", response.status);
    return "failed";
  } catch (error) {
    console.error("[gestionale] Web Push non consegnata:", error instanceof Error ? error.message : "errore");
    return "failed";
  }
}

/**
 * Viene richiamata dopo le RPC di inserimento; l'inserimento nel database
 * delle notifiche è già avvenuto in maniera atomica tramite trigger.
 * Il salvataggio di Ale resta valido anche se il servizio push è offline.
 */
export async function dispatchAlePush(operatorId: string): Promise<void> {
  const db = getGestionaleDb();
  const { data: pending, error } = await db.from("gw_admin_notifications")
    .select("id,recipient_operator_id,kind,href,title")
    .eq("actor_operator_id", operatorId)
    .is("push_sent_at", null)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error || !pending?.length) return;
  if (!pushConfigured()) {
    // I vecchi eventi non devono essere inviati quando le push verranno attivate.
    await db.from("gw_admin_notifications").update({ push_sent_at: new Date().toISOString() })
      .in("id", pending.map(n => n.id));
    return;
  }
  const { data: subscriptions, error: subscriptionsError } = await db.from("gw_admin_push_subscriptions")
    .select("operator_id,endpoint,p256dh,auth")
    .in("operator_id", [...new Set(pending.map(n => n.recipient_operator_id))]);
  if (subscriptionsError) return;
  const devices = subscriptions as PushSubscriptionRecord[] | null;
  // Pacchetti piccoli per non sovraccaricare la funzione serverless.
  for (let i = 0; i < pending.length; i += 12) {
    await Promise.all(pending.slice(i, i + 12).map(async n => {
      const targets = (devices ?? []).filter(s => s.operator_id === n.recipient_operator_id);
      const outcomes = await Promise.all(targets.map(async subscription => {
        // Dati personali e recapiti restano nella campanella autenticata.
        const outcome = await sendWebPush(subscription, {
          title: n.title,
          body: "Apri il gestionale Peony per i dettagli.",
          url: n.href,
          tag: n.id,
        });
        if (outcome === "expired") {
          await db.from("gw_admin_push_subscriptions").delete()
            .eq("operator_id", n.recipient_operator_id).eq("endpoint", subscription.endpoint);
        }
        return outcome;
      }));
      if (outcomes.every(o => o !== "failed")) {
        await db.from("gw_admin_notifications")
          .update({ push_sent_at: new Date().toISOString() })
          .eq("id", n.id).is("push_sent_at", null);
      }
    }));
  }
}
