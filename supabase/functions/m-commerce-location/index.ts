import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")??"";
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const GOOGLE_ENV=(Deno.env.get("GOOGLE_MAPS_BROWSER_KEY")??"").trim();
const DEFAULT_COUNTRY=(Deno.env.get("J3_MAPS_COUNTRY")||"AR").toUpperCase();
const buckets=new Map<string,{start:number,count:number}>();

function cors(req:Request,contentType="application/json; charset=utf-8"){
  const origin=req.headers.get("origin")||"*";
  return {
    "access-control-allow-origin":origin,
    "access-control-allow-headers":"authorization,apikey,content-type",
    "access-control-allow-methods":"GET,OPTIONS",
    "vary":"origin",
    "cache-control":"no-store",
    "content-type":contentType
  };
}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:cors(req)})}
function finite(v:string|null,min:number,max:number){const n=Number(v);return Number.isFinite(n)&&n>=min&&n<=max?n:null}
function allow(req:Request){
  const ip=(req.headers.get("x-forwarded-for")||req.headers.get("cf-connecting-ip")||"unknown").split(",")[0].trim();
  const now=Date.now(),old=buckets.get(ip);
  if(!old||now-old.start>60_000){buckets.set(ip,{start:now,count:1});return true}
  old.count++;return old.count<=80;
}
function normalizeGeoapify(feature:any){
  const p=feature?.properties||{};
  const lat=Number(p.lat??feature?.geometry?.coordinates?.[1]);
  const lng=Number(p.lon??feature?.geometry?.coordinates?.[0]);
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return null;
  return {lat,lng,formatted:String(p.formatted||p.address_line2||p.address_line1||"").slice(0,500),place_id:String(p.place_id||p.datasource?.raw?.place_id||"").slice(0,240),city:String(p.city||p.town||p.village||p.county||""),postcode:String(p.postcode||"")};
}
function normalizeGoogle(r:any){
  const lat=Number(r?.geometry?.location?.lat),lng=Number(r?.geometry?.location?.lng);
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return null;
  return {lat,lng,formatted:String(r?.formatted_address||"").slice(0,500),place_id:String(r?.place_id||"").slice(0,240),city:"",postcode:""};
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});
  if(req.method!=="GET")return json(req,{ok:false,error:"METHOD_NOT_ALLOWED"},405);
  if(!allow(req))return json(req,{ok:false,error:"TOO_MANY_REQUESTS",message:"Esperá unos segundos y volvé a intentar."},429);
  if(!SUPABASE_URL||!SERVICE)return json(req,{ok:false,error:"SERVER_NOT_CONFIGURED"},503);
  try{
    const url=new URL(req.url),action=String(url.searchParams.get("action")||"search");
    const admin=createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false}});
    const {data:row,error}=await admin.from("platform_maps_settings").select("provider,browser_key,geoapify_key,country,language").eq("id",1).maybeSingle();
    if(error)throw error;
    const provider=String(row?.provider||"geoapify").toLowerCase();
    const country=String(row?.country||DEFAULT_COUNTRY||"AR").toLowerCase();
    const language=String(row?.language||"es").toLowerCase();
    const geoKey=String(row?.geoapify_key||"").trim();
    const googleKey=GOOGLE_ENV||String(row?.browser_key||"").trim();

    if(action==="search"){
      const q=String(url.searchParams.get("q")||"").trim().slice(0,180);
      if(q.length<3)return json(req,{ok:true,results:[]});
      if(provider==="google"&&googleKey){
        const target=new URL("https://maps.googleapis.com/maps/api/geocode/json");
        target.searchParams.set("address",q);
        target.searchParams.set("components",`country:${country}`);
        target.searchParams.set("language",language);
        target.searchParams.set("key",googleKey);
        const r=await fetch(target);const out=await r.json();
        if(!r.ok||out.status!=="OK"&&out.status!=="ZERO_RESULTS")throw new Error("GOOGLE_GEOCODE_FAILED");
        return json(req,{ok:true,provider:"google",results:(out.results||[]).slice(0,6).map(normalizeGoogle).filter(Boolean)});
      }
      if(!geoKey)return json(req,{ok:false,error:"MAPS_NOT_CONFIGURED"},503);
      const target=new URL("https://api.geoapify.com/v1/geocode/autocomplete");
      target.searchParams.set("text",q);target.searchParams.set("format","geojson");target.searchParams.set("filter",`countrycode:${country}`);target.searchParams.set("lang",language);target.searchParams.set("limit","6");target.searchParams.set("apiKey",geoKey);
      const r=await fetch(target,{headers:{"user-agent":"MCommerce/1.0 (+https://m-commerce-ar.vercel.app)"}});const out=await r.json();
      if(!r.ok)throw new Error("GEOAPIFY_SEARCH_FAILED");
      return json(req,{ok:true,provider:"geoapify",results:(out.features||[]).map(normalizeGeoapify).filter(Boolean)});
    }

    if(action==="reverse"){
      const lat=finite(url.searchParams.get("lat"),-90,90),lng=finite(url.searchParams.get("lng"),-180,180);
      if(lat===null||lng===null)return json(req,{ok:false,error:"INVALID_COORDINATES"},422);
      if(provider==="google"&&googleKey){
        const target=new URL("https://maps.googleapis.com/maps/api/geocode/json");target.searchParams.set("latlng",`${lat},${lng}`);target.searchParams.set("language",language);target.searchParams.set("key",googleKey);
        const r=await fetch(target);const out=await r.json();if(!r.ok||out.status!=="OK")throw new Error("GOOGLE_REVERSE_FAILED");
        const result=normalizeGoogle(out.results?.[0]);return json(req,{ok:true,provider:"google",result:result||{lat,lng,formatted:`${lat}, ${lng}`,place_id:""}});
      }
      if(!geoKey)return json(req,{ok:false,error:"MAPS_NOT_CONFIGURED"},503);
      const target=new URL("https://api.geoapify.com/v1/geocode/reverse");target.searchParams.set("lat",String(lat));target.searchParams.set("lon",String(lng));target.searchParams.set("format","geojson");target.searchParams.set("lang",language);target.searchParams.set("apiKey",geoKey);
      const r=await fetch(target,{headers:{"user-agent":"MCommerce/1.0 (+https://m-commerce-ar.vercel.app)"}});const out=await r.json();if(!r.ok)throw new Error("GEOAPIFY_REVERSE_FAILED");
      const result=normalizeGeoapify(out.features?.[0]);return json(req,{ok:true,provider:"geoapify",result:result||{lat,lng,formatted:`${lat}, ${lng}`,place_id:""}});
    }

    if(action==="static"){
      const lat=finite(url.searchParams.get("lat"),-90,90),lng=finite(url.searchParams.get("lng"),-180,180);
      if(lat===null||lng===null)return json(req,{ok:false,error:"INVALID_COORDINATES"},422);
      if(!geoKey)return new Response(null,{status:204,headers:cors(req,"image/png")});
      const target=new URL("https://maps.geoapify.com/v1/staticmap");
      target.searchParams.set("style","osm-bright");target.searchParams.set("width","720");target.searchParams.set("height","300");target.searchParams.set("center",`lonlat:${lng},${lat}`);target.searchParams.set("zoom","16");target.searchParams.set("marker",`lonlat:${lng},${lat};color:%236d5dfc;size:large`);target.searchParams.set("apiKey",geoKey);
      const r=await fetch(target);if(!r.ok)return new Response(null,{status:204,headers:cors(req,"image/png")});
      return new Response(await r.arrayBuffer(),{status:200,headers:{...cors(req,r.headers.get("content-type")||"image/png"),"cache-control":"public, max-age=300"}});
    }

    return json(req,{ok:false,error:"INVALID_ACTION"},422);
  }catch(e){
    const message=e instanceof Error?e.message:String(e);
    console.error(JSON.stringify({event:"m_commerce_location_error",message:message.slice(0,250)}));
    return json(req,{ok:false,error:"LOCATION_SERVICE_FAILED",message:"No pudimos consultar el mapa. Intentá nuevamente."},500);
  }
});
