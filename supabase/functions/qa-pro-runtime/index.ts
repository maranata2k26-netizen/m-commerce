import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.117.2";
const STAGE="https://jcgvunffeskkbgsbomgy.supabase.co";
const ALLOWED=new Set(["config.js","platform.js","platform.css","comercio.html","master.html","auth.html","diseno.html","vendedor.html","index.html","reset-j3.html"]);
const headers={"access-control-allow-origin":"https://m-commerce-staging.vercel.app","access-control-allow-headers":"apikey,authorization,content-type","cache-control":"no-store","x-content-type-options":"nosniff"};
const respond=(body:string,status=200,type="application/json")=>new Response(status===204?null:body,{status,headers:{...headers,"content-type":type}});
Deno.serve(async req=>{
 if(Deno.env.get("SUPABASE_URL")!==STAGE)return respond('{"error":"STAGING_ONLY"}',404);
 if(req.method==="OPTIONS")return respond("",204);
 if(!["GET","HEAD"].includes(req.method))return respond('{"error":"METHOD_NOT_ALLOWED"}',405);
 try{
  const url=new URL(req.url),file=url.searchParams.get("path")||"";
  const key=req.headers.get("apikey")||url.searchParams.get("apikey");
  if(key!=="sb_publishable_5TX-YZ5p7yiZHZDAjQSGXg_c29FCBQ8")return respond('{"error":"STAGING_API_KEY_REQUIRED"}',401);
  if(req.headers.get("origin")&&req.headers.get("origin")!=="https://m-commerce-staging.vercel.app")return respond('{"error":"ORIGIN_NOT_ALLOWED"}',403);
  if(file==="m-commerce-icon.svg")return new Response(null,{status:302,headers:{...headers,location:"https://m-commerce-staging.vercel.app/assets/m-commerce-mark.svg"}});
  if(file==="qa-manifest.json")return respond(JSON.stringify({name:"M Commerce PRO QA",short_name:"PRO QA",start_url:"https://m-commerce-staging.vercel.app/qa-pro/comercio",display:"standalone",icons:[{src:"https://m-commerce-staging.vercel.app/assets/m-commerce-mark.svg",sizes:"any",type:"image/svg+xml"}]}));
  const admin=createClient(STAGE,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{persistSession:false}});
  if(url.searchParams.get("health")==="1"||file==="app-version.json")return respond(JSON.stringify({ok:true,product:"M Commerce PRO QA",version:"182",release_id:"182@2026-09-21T20:34:43.742726+00:00",update_protocol:5,source:"supabase-runtime",components:{merchant:"182",master:"182",storefront:"182",seller:"182"}}));
  if(!ALLOWED.has(file))return respond('{"error":"FILE_NOT_ALLOWED"}',404);
  const {data,error}=await admin.from("platform_runtime_files").select("content,content_type,sha256").eq("path",file).maybeSingle();
  if(error||!data||!/^[a-f0-9]{64}$/.test(data.sha256||""))return respond('{"error":"SNAPSHOT_UNAVAILABLE"}',503);
  if(String(data.content).includes("kjoixhzaxopdbmudzfsg"))return respond('{"error":"PRODUCTION_REFERENCE_BLOCKED"}',503);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(data.content))),x=>x.toString(16).padStart(2,"0")).join("");
  if(hash!==data.sha256)return respond('{"error":"SNAPSHOT_HASH_MISMATCH"}',503);
  const content=String(data.content).replaceAll(STAGE+"/functions/v1/m-commerce-manifest?",STAGE+"/functions/v1/qa-pro-runtime?apikey=sb_publishable_5TX-YZ5p7yiZHZDAjQSGXg_c29FCBQ8&path=qa-manifest.json&");
  return respond(req.method==="HEAD"?"":content,200,data.content_type||"text/plain");
 }catch{return respond('{"error":"RUNTIME_UNAVAILABLE"}',503);}
});
