import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")??"";
const SERVICE_ROLE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const ANON=Deno.env.get("SUPABASE_ANON_KEY")??"";
const CLIENT_ID=(Deno.env.get("MERCADOPAGO_CLIENT_ID")??"").trim();
const CLIENT_SECRET=(Deno.env.get("MERCADOPAGO_CLIENT_SECRET")??"").trim();
const PUBLIC_URL="https://mcommerce.vercel.app";
const OLD_PUBLIC_URL="https://m-commerce-ar.vercel.app";
const LEGACY_PUBLIC_URL="https://j3-plataform.vercel.app";
const CALLBACK=`${SUPABASE_URL}/functions/v1/mercadopago-connect`;
const KNOWN=new Set(["AUTH_REQUIRED","ADMIN_REQUIRED","SITE_ACCESS_DENIED","OWNER_REQUIRED","OAUTH_APP_NOT_CONFIGURED","INVALID_ACTION","METHOD_NOT_ALLOWED","MP_OAUTH_TOKEN_FAILED","MP_ACCOUNT_VERIFY_FAILED","MP_ACCOUNT_ALREADY_USED","MP_ACCOUNT_IN_USE","STATE_INVALID","STATE_EXPIRED","STATE_TYPE_INVALID","NO_MP_USER","INTERNAL_ERROR"]);

function b64url(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
async function sha256(s:string){return new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))}
function random(n=48){return b64url(crypto.getRandomValues(new Uint8Array(n)))}
function safeError(e:unknown){if(e instanceof Error&&KNOWN.has(e.message))return e.message;const x=e as Record<string,unknown>|null;const candidate=String(x?.message||x?.code||"");return KNOWN.has(candidate)?candidate:"INTERNAL_ERROR"}
function cors(req:Request){const o=req.headers.get("origin");const allowed=o===PUBLIC_URL||o===OLD_PUBLIC_URL||o===LEGACY_PUBLIC_URL;return {"Access-Control-Allow-Origin":allowed?o:PUBLIC_URL,"Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Vary":"Origin"}}
function json(req:Request,b:unknown,status=200){return new Response(JSON.stringify(b),{status,headers:{...cors(req),"content-type":"application/json","cache-control":"no-store"}})}
function redirect(url:string){return new Response(null,{status:303,headers:{Location:url,"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}})}
function email(v:unknown){return String(v??"").trim().toLowerCase()}
function target(flow:string,ok=false,reason=""){const base=flow==="platform_billing"?"/master.html":"/app-comercio/panel";const key=flow==="platform_billing"?"billing":"mp";const u=new URL(base,PUBLIC_URL);u.searchParams.set(key,ok?(flow==="platform_billing"?"pending":"connected"):"error");if(reason)u.searchParams.set("reason",reason);return u.toString()}
function flowFromState(state:string){if(state.startsWith("pb."))return "platform_billing";if(state.startsWith("mc."))return "merchant";return ""}
async function authUser(req:Request){const auth=req.headers.get("authorization")||"";if(!auth.startsWith("Bearer "))throw new Error("AUTH_REQUIRED");const c=createClient(SUPABASE_URL,ANON,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});const {data:{user},error}=await c.auth.getUser();if(error||!user)throw new Error("AUTH_REQUIRED");return user}
async function canManageMerchant(admin:any,userId:string,siteId:string){const prof=await admin.from("profiles").select("role").eq("id",userId).maybeSingle();if(prof.error)throw prof.error;if(prof.data?.role==="admin")return true;const owner=await admin.from("site_memberships").select("id").eq("site_id",siteId).eq("user_id",userId).eq("status","active").eq("role","merchant_owner").maybeSingle();if(owner.error)throw owner.error;return !!owner.data}
async function exchangeCode(code:string,verifier:string){const r=await fetch("https://api.mercadopago.com/oauth/token",{method:"POST",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify({client_id:CLIENT_ID,client_secret:CLIENT_SECRET,grant_type:"authorization_code",code,redirect_uri:CALLBACK,code_verifier:verifier})});const p=await r.json().catch(()=>({}));if(!r.ok||!p?.access_token)throw new Error("MP_OAUTH_TOKEN_FAILED");return p}
async function mpProfile(token:string){const r=await fetch("https://api.mercadolibre.com/users/me",{headers:{authorization:`Bearer ${token}`,accept:"application/json"},cache:"no-store"});const p=await r.json().catch(()=>({}));if(!r.ok||!p?.id)throw new Error("MP_ACCOUNT_VERIFY_FAILED");return p}

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});
 const admin=createClient(SUPABASE_URL,SERVICE_ROLE,{auth:{persistSession:false}});
 const requestId=crypto.randomUUID();
 let callbackFlow="";
 try{
  if(req.method==="GET"){
   const u=new URL(req.url),state=u.searchParams.get("state")||"",code=u.searchParams.get("code")||"";
   callbackFlow=flowFromState(state);
   if(!callbackFlow)return redirect(target("merchant",false,"state"));
   const table=callbackFlow==="platform_billing"?"platform_billing_oauth_states":"oauth_states";
   const stateHash=b64url(await sha256(state));
   const found=await admin.from(table).select("*").eq("state_hash",stateHash).eq("flow_type",callbackFlow).maybeSingle();
   if(found.error)throw found.error;
   if(!found.data)return redirect(target(callbackFlow,false,"state"));
   await admin.from(table).delete().eq("state_hash",stateHash);
   if(new Date(found.data.expires_at).getTime()<=Date.now())return redirect(target(callbackFlow,false,"state_expired"));
   if(u.searchParams.get("error"))return redirect(target(callbackFlow,false,"cancelled"));
   if(!code)return redirect(target(callbackFlow,false,"code"));
   if(!CLIENT_ID||!CLIENT_SECRET)return redirect(target(callbackFlow,false,"config"));

   if(callbackFlow==="platform_billing"){
    const prof=await admin.from("profiles").select("role").eq("id",found.data.user_id).maybeSingle();
    if(prof.error||prof.data?.role!=="admin")return redirect(target(callbackFlow,false,"admin"));
    const token=await exchangeCode(code,found.data.code_verifier);
    const profile=await mpProfile(String(token.access_token));
    const mpUserId=String(token.user_id||profile.id||"");if(!mpUserId)throw new Error("NO_MP_USER");
    const expires=token.expires_in?new Date(Date.now()+Number(token.expires_in)*1000).toISOString():null;
    const saved=await admin.from("platform_billing_accounts").upsert({provider:"mercadopago",mp_user_id:mpUserId,access_token:token.access_token,refresh_token:token.refresh_token||null,token_type:token.token_type||"Bearer",scope:token.scope||"",expires_at:expires,status:"pending_confirmation",connected_by:found.data.user_id,expected_email:email(found.data.expected_email)||null,account_email:email(profile.email)||null,account_nickname:String(profile.nickname||""),account_first_name:String(profile.first_name||""),account_last_name:String(profile.last_name||""),confirmed_at:null,updated_at:new Date().toISOString()},{onConflict:"provider"});
    if(saved.error)throw saved.error;
    return redirect(target(callbackFlow,true));
   }

   if(!await canManageMerchant(admin,String(found.data.user_id),String(found.data.site_id)))return redirect(target(callbackFlow,false,"owner_required"));
   const token=await exchangeCode(code,found.data.code_verifier);
   const profile=await mpProfile(String(token.access_token));
   const mpUserId=String(token.user_id||profile.id||"");if(!mpUserId)throw new Error("NO_MP_USER");
   const duplicate=await admin.from("mercadopago_connections").select("site_id").eq("mp_user_id",mpUserId).eq("status","connected").neq("site_id",found.data.site_id).limit(1).maybeSingle();
   if(duplicate.error)throw duplicate.error;if(duplicate.data)return redirect(target(callbackFlow,false,"account_in_use"));
   const expires=token.expires_in?new Date(Date.now()+Number(token.expires_in)*1000).toISOString():null;
   const saved=await admin.from("mercadopago_connections").upsert({site_id:found.data.site_id,mp_user_id:mpUserId,access_token:token.access_token,refresh_token:token.refresh_token||null,token_type:token.token_type||"Bearer",scope:token.scope||"",expires_at:expires,status:"connected",updated_at:new Date().toISOString()},{onConflict:"site_id"});
   if(saved.error)throw saved.error;
   const siteResult=await admin.from("sites").select("product_tier").eq("id",found.data.site_id).maybeSingle();
   if(siteResult.data?.product_tier==="simple"){
    const simpleTarget=new URL("/simple/app",PUBLIC_URL);
    simpleTarget.searchParams.set("mp","connected");
    simpleTarget.searchParams.set("site",String(found.data.site_id));
    return redirect(simpleTarget.toString());
   }
   return redirect(`${target(callbackFlow,true)}&site=${encodeURIComponent(found.data.site_id)}`);
  }

  if(req.method!=="POST")return json(req,{error:"METHOD_NOT_ALLOWED"},405);
  const user=await authUser(req),body=await req.json().catch(()=>({}));
  if(!["start","disconnect"].includes(body?.action))return json(req,{error:"INVALID_ACTION"},422);
  const siteId=String(body?.site_id||"");
  if(!await canManageMerchant(admin,user.id,siteId))return json(req,{error:"OWNER_REQUIRED",message:"Solo el dueño del comercio o el administrador maestro puede administrar Mercado Pago."},403);
  if(body.action==="disconnect"){const stopped=await admin.from("mercadopago_connections").update({status:"disconnected",updated_at:new Date().toISOString()}).eq("site_id",siteId);if(stopped.error)throw stopped.error;await admin.from("oauth_states").delete().eq("site_id",siteId);return json(req,{connected:false})}
  if(!CLIENT_ID||!CLIENT_SECRET)return json(req,{error:"OAUTH_APP_NOT_CONFIGURED"},503);
  await admin.from("oauth_states").delete().eq("user_id",user.id);await admin.from("oauth_states").delete().lt("expires_at",new Date().toISOString());
  const opaque=random(32),state=`mc.${opaque}`,verifier=random(64),challenge=b64url(await sha256(verifier)),stateHash=b64url(await sha256(state));
  const saved=await admin.from("oauth_states").insert({state_hash:stateHash,site_id:siteId,user_id:user.id,code_verifier:verifier,flow_type:"merchant",expires_at:new Date(Date.now()+10*60_000).toISOString()});if(saved.error)throw saved.error;
  const authUrl=new URL("https://auth.mercadopago.com.ar/authorization");authUrl.searchParams.set("response_type","code");authUrl.searchParams.set("client_id",CLIENT_ID);authUrl.searchParams.set("platform_id","mp");authUrl.searchParams.set("redirect_uri",CALLBACK);authUrl.searchParams.set("state",state);authUrl.searchParams.set("code_challenge",challenge);authUrl.searchParams.set("code_challenge_method","S256");authUrl.searchParams.set("scope","read write offline_access");
  return json(req,{authorization_url:authUrl.toString()});
 }catch(e){const code=safeError(e);console.error(JSON.stringify({event:"mp_oauth_error",request_id:requestId,flow:callbackFlow||"api",code}));if(req.method==="GET")return redirect(target(callbackFlow||"merchant",false,code==="INTERNAL_ERROR"?"internal":code.toLowerCase()));return json(req,{error:code,message:code},code==="AUTH_REQUIRED"?401:code==="OWNER_REQUIRED"?403:400)}
});