import { createClient } from "npm:@supabase/supabase-js@2.117.2";
const STAGING="https://jcgvunffeskkbgsbomgy.supabase.co";
const ORIGIN="https://m-commerce-staging.vercel.app";
const url=(Deno.env.get("SUPABASE_URL")||"").replace(/\/+$/,"");
function reply(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store","access-control-allow-origin":ORIGIN,"access-control-allow-headers":"authorization, apikey, content-type","access-control-allow-methods":"POST, OPTIONS"}})}
Deno.serve(async(req:Request)=>{
 if(url!==STAGING)return reply({error:"STAGING_ONLY"},403);
 if(req.method==="OPTIONS")return reply({ok:true});
 if(req.method!=="POST")return reply({error:"METHOD_NOT_ALLOWED"},405);
 try{
  const authorization=req.headers.get("authorization")||"";
  if(!authorization.startsWith("Bearer "))return reply({error:"AUTH_REQUIRED"},401);
  const client=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")||"",{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)return reply({error:"AUTH_REQUIRED"},401);
  const admin=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{persistSession:false}});
  const {data:profile,error:roleError}=await admin.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(roleError||profile?.role!=="admin")return reply({error:"ADMIN_REQUIRED"},403);
  const body=await req.json();const expected=String(body.expected_test_user_id||"");
  if(!/^\d+$/.test(expected))return reply({error:"EXPECTED_TEST_USER_REQUIRED"},422);
  const token=(Deno.env.get("QA_MP_ACCESS_TOKEN")||"").trim();
  if(!token)return reply({error:"TEST_TOKEN_NOT_CONFIGURED"},409);
  const response=await fetch("https://api.mercadolibre.com/users/me",{headers:{authorization:`Bearer ${token}`,accept:"application/json"},signal:AbortSignal.timeout(10000)});
  const account=await response.json();
  if(!response.ok||!account.id)return reply({error:"PROVIDER_IDENTITY_FAILED"},502);
  if(!Array.isArray(account.tags)||!account.tags.includes("test_user"))return reply({error:"REAL_ACCOUNT_REFUSED"},422);
  if(String(account.id)!==expected||account.site_id!=="MLA")return reply({error:"TEST_IDENTITY_MISMATCH"},422);
  const email=String(account.email||"").trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply({error:"PROVIDER_EMAIL_REQUIRED"},422);
  const {data:used,error:usageError}=await admin.from("mercadopago_connections").select("site_id").eq("mp_user_id",expected).eq("status","connected");
  if(usageError)throw usageError;
  if(used?.length)return reply({error:"MERCHANT_ACCOUNT_REFUSED"},409);
  const {data:existing,error:existingError}=await admin.from("platform_billing_accounts").select("status,mp_user_id").eq("provider","mercadopago").maybeSingle();
  if(existingError)throw existingError;
  if(existing?.status==="connected")return reply({error:"CONNECTED_ACCOUNT_PRESERVED"},409);
  if(body.action!=="prepare")return reply({ok:true,test_user:true,expected_identity:true,site:"MLA",ready_to_prepare:true});
  const record={provider:"mercadopago",access_token:token,mp_user_id:expected,account_email:email,expected_email:email,account_nickname:String(account.nickname||""),account_first_name:String(account.first_name||""),account_last_name:String(account.last_name||""),status:"pending_confirmation",connected_by:user.id,confirmed_at:null,refresh_token:null,expires_at:null,allowed_shared_merchant_site_id:null,updated_at:new Date().toISOString()};
  const saved=existing?await admin.from("platform_billing_accounts").update(record).eq("provider","mercadopago").neq("status","connected").select("provider"):await admin.from("platform_billing_accounts").insert(record).select("provider");
  const saveError=saved.error;
  if(!saveError&&saved.data?.length!==1)return reply({error:"ACCOUNT_CHANGED"},409);
  if(saveError)throw saveError;
  return reply({ok:true,test_user:true,expected_identity:true,status:"pending_confirmation"});
 }catch{return reply({error:"QA_SETUP_FAILED"},500)}
});
