import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")??"";
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const ORIGINS=new Set(["https://mcommerce.vercel.app","https://m-commerce-ar.vercel.app","http://localhost:3000","http://127.0.0.1:3000"]);
const cors=(req:Request)=>{const origin=req.headers.get("origin")||"";return {"access-control-allow-origin":ORIGINS.has(origin)?origin:"https://mcommerce.vercel.app","access-control-allow-headers":"apikey,content-type","access-control-allow-methods":"POST,OPTIONS","vary":"origin","cache-control":"no-store"}};
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors(req),"content-type":"application/json; charset=utf-8"}});
const cut=(v:unknown,n:number)=>String(v??"").trim().slice(0,n);
async function hash(value:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,"0")).join("")}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});
  if(req.method!=="POST")return json(req,{error:"METHOD_NOT_ALLOWED"},405);
  if(!SUPABASE_URL||!SERVICE)return json(req,{error:"SERVER_NOT_CONFIGURED"},503);
  const origin=req.headers.get("origin")||"";
  if(origin&&!ORIGINS.has(origin))return json(req,{error:"ORIGIN_NOT_ALLOWED"},403);
  try{
    const body=await req.json(),name=cut(body?.name,120),email=cut(body?.email,254).toLowerCase(),phone=cut(body?.phone,40),business=cut(body?.business_name,120),details=cut(body?.details,2000);
    if(name.length<2||business.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||phone.replace(/\D/g,"").length<8)return json(req,{error:"INVALID_CONTACT",message:"Completá nombre, comercio, email y teléfono válidos."},422);
    const admin=createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false}});
    const ip=(req.headers.get("x-forwarded-for")??"unknown").split(",")[0].trim();
    const {data:allowed,error:rateError}=await admin.rpc("checkout_rate_limit_v19",{p_key_hash:await hash(`${ip}|pro-lead`),p_limit:5});
    if(rateError)throw rateError;
    if(!allowed)return json(req,{error:"TOO_MANY_REQUESTS",message:"Esperá unos minutos antes de volver a enviar."},429);
    const {data,error}=await admin.from("simple_pro_leads").insert({name,email,phone,business_name:business,details}).select("id").single();
    if(error)throw error;
    console.log(JSON.stringify({event:"pro_lead_created",lead_id:data.id,source:"simple_landing"}));
    return json(req,{ok:true,lead_id:data.id},201);
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    console.error(JSON.stringify({event:"pro_lead_failed",error:message.slice(0,200)}));
    return json(req,{error:"LEAD_CREATE_FAILED",message:"No pudimos enviar la solicitud. Intentá nuevamente."},400);
  }
});
