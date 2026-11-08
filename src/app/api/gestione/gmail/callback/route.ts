import { timingSafeEqual } from "node:crypto";
import { NextRequest,NextResponse } from "next/server";
import { google } from "googleapis";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { newGmailOAuthClient,PEONY_GMAIL_ADDRESS,saveGmailRefreshToken } from "@/lib/gestionale/server/payment-gmail-oauth";
const STATE_COOKIE="gw_gmail_oauth_state";
function safeEqual(a:string,b:string){
 const left=Buffer.from(a),right=Buffer.from(b);
 return left.length===right.length&&timingSafeEqual(left,right);
}
function redirectWith(request:NextRequest,status:string){
 const response=NextResponse.redirect(new URL(`/gestione/quote-email?gmail=${status}`,request.url));
 response.cookies.set(STATE_COOKIE,"",{httpOnly:true,sameSite:"lax",
  secure:request.nextUrl.protocol==="https:",path:"/api/gestione/gmail",maxAge:0});
 return response;
}
export async function GET(request:NextRequest){
 const admin=await requireAdmin();
 const expected=request.cookies.get(STATE_COOKIE)?.value??"";
 const received=request.nextUrl.searchParams.get("state")??"";
 const code=request.nextUrl.searchParams.get("code")??"";
 if(!expected||!received||!safeEqual(expected,received)||!code)
  return redirectWith(request,"invalid");
 try{
  const client=newGmailOAuthClient();
  const {tokens}=await client.getToken(code);
  const scope=(tokens.scope||"").split(/\s+/);
  if(!tokens.refresh_token||!scope.includes("https://www.googleapis.com/auth/gmail.readonly"))
   return redirectWith(request,"scope");
  client.setCredentials(tokens);
  const profile=await google.gmail({version:"v1",auth:client}).users.getProfile({userId:"me"});
  if(profile.data.emailAddress?.toLowerCase()!==PEONY_GMAIL_ADDRESS)
   return redirectWith(request,"wrong-account");
  await saveGmailRefreshToken(tokens.refresh_token,admin.id);
  return redirectWith(request,"connected");
 }catch{
  return redirectWith(request,"error");
 }
}
