#!/usr/bin/env node
// Eseguire localmente: node scripts/gestionale/generate-vapid.mjs
// Inserire le tre variabili nella configurazione Netlify (solo server).
import { createECDH } from "node:crypto";
const key = createECDH("prime256v1");
key.generateKeys();
console.log("GW_VAPID_PUBLIC_KEY=" + key.getPublicKey(undefined, "uncompressed").toString("base64url"));
console.log("GW_VAPID_PRIVATE_KEY=" + key.getPrivateKey().toString("base64url"));
console.log("GW_VAPID_SUBJECT=mailto:peony.studio.turin@gmail.com");
