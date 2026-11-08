import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { newGmailOAuthClient } from "@/lib/gestionale/server/payment-gmail-oauth";

const STATE_COOKIE="gw_gmail_oauth_state";
export async function GET(request:NextRequest){
 await requireAdmin();
 try{
  const nonce=randomBytes(24).toString("base64url");
  const client=newGmailOAuthClient();
  const url=client.generateAuthUrl({
   access_type:"offline",prompt:"consent",include_granted_scopes:false,
   scope:["https://www.googleapis.com/auth/gmail.readonly"],state:nonce
  });
  const response=NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE,nonce,{
   httpOnly:true,secure:request.nextUrl.protocol==="https:",sameSite:"lax",
   path:"/api/gestione/gmail",maxAge:600
  });
  return response;
 }catch{
  return NextResponse.redirect(new URL("/gestione/quote-email?gmail=config",request.url));
 }
}
