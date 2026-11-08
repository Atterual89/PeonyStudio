import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { google } from "googleapis";
import { getGestionaleDb } from "@/lib/gestionale/server/db";

export const PEONY_GMAIL_ADDRESS="peony.studio.turin@gmail.com";
const CONNECTION_ID="peony";

export function gmailOAuthConfig(){
 const clientId=process.env.GMAIL_PAYMENTS_CLIENT_ID?.trim();
 const clientSecret=process.env.GMAIL_PAYMENTS_CLIENT_SECRET?.trim();
 const redirectUri=process.env.GMAIL_PAYMENTS_REDIRECT_URI?.trim();
 if(!clientId||!clientSecret||!redirectUri||!redirectUri.startsWith("https://"))
  throw new Error("Configura client ID, client secret e redirect URI Gmail OAuth nell'hosting del sito.");
 return {clientId,clientSecret,redirectUri};
}
function encryptionKey(){
 const raw=process.env.GMAIL_PAYMENTS_TOKEN_KEY||"";
 const key=Buffer.from(raw,"base64");
 if(key.length!==32)throw new Error("GMAIL_PAYMENTS_TOKEN_KEY deve contenere una chiave casuale di 32 byte codificata base64.");
 return key;
}
function encrypt(token:string){
 const iv=randomBytes(12);
 const cipher=createCipheriv("aes-256-gcm",encryptionKey(),iv);
 const ciphertext=Buffer.concat([cipher.update(token,"utf8"),cipher.final()]);
 return [iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),
   ciphertext.toString("base64url")].join(".");
}
function decrypt(encoded:string){
 const pieces=encoded.split(".");
 if(pieces.length!==3)throw new Error("Token Gmail cifrato non valido.");
 const [iv,tag,data]=pieces.map(part=>Buffer.from(part,"base64url"));
 const decipher=createDecipheriv("aes-256-gcm",encryptionKey(),iv);
 decipher.setAuthTag(tag);
 return Buffer.concat([decipher.update(data),decipher.final()]).toString("utf8");
}
export function newGmailOAuthClient(){
 const {clientId,clientSecret,redirectUri}=gmailOAuthConfig();
 return new google.auth.OAuth2(clientId,clientSecret,redirectUri);
}
export async function saveGmailRefreshToken(token:string,updatedBy:string){
 if(!token||token.length<15)throw new Error("Google non ha restituito un refresh token.");
 const {error}=await getGestionaleDb().from("gw_gmail_connections").upsert({
  id:CONNECTION_ID,gmail_address:PEONY_GMAIL_ADDRESS,
  refresh_token_ciphertext:encrypt(token),updated_by:updatedBy,updated_at:new Date().toISOString()
 },{onConflict:"id"});
 if(error)throw new Error("Impossibile memorizzare il collegamento Gmail protetto.");
}
export async function gmailConnectionStatus(){
 const names=[
  "GMAIL_PAYMENTS_CLIENT_ID","GMAIL_PAYMENTS_CLIENT_SECRET",
  "GMAIL_PAYMENTS_REDIRECT_URI","GMAIL_PAYMENTS_TOKEN_KEY"
 ] as const;
 const missing=names.filter(name=>!process.env[name]?.trim());
 const redirect=process.env.GMAIL_PAYMENTS_REDIRECT_URI?.trim()||"";
 const key=process.env.GMAIL_PAYMENTS_TOKEN_KEY?.trim()||"";
 if(redirect&&!redirect.startsWith("https://"))
  missing.push("GMAIL_PAYMENTS_REDIRECT_URI");
 if(key&&Buffer.from(key,"base64").length!==32)
  missing.push("GMAIL_PAYMENTS_TOKEN_KEY");
 const configured=missing.length===0;
 const {data,error}=await getGestionaleDb().from("gw_gmail_connections")
   .select("gmail_address,updated_at").eq("id",CONNECTION_ID).maybeSingle();
 if(error)return {configured,connected:Boolean(process.env.GMAIL_PAYMENTS_REFRESH_TOKEN),updatedAt:null,missing};
 return {configured,connected:Boolean(data||process.env.GMAIL_PAYMENTS_REFRESH_TOKEN),updatedAt:data?.updated_at??null,missing};
}
export async function gmailAuthForPayments(){
 const auth=newGmailOAuthClient();
 let token=process.env.GMAIL_PAYMENTS_REFRESH_TOKEN?.trim()||null;
 if(!token){
  const {data,error}=await getGestionaleDb().from("gw_gmail_connections")
   .select("refresh_token_ciphertext").eq("id",CONNECTION_ID).maybeSingle();
  if(error)throw new Error("Collegamento Gmail non disponibile nel database.");
  if(!data?.refresh_token_ciphertext)throw new Error("Collega la casella Gmail Peony Studio dalla pagina Quote associative.");
  token=decrypt(data.refresh_token_ciphertext);
 }
 auth.setCredentials({refresh_token:token});
 return auth;
}
