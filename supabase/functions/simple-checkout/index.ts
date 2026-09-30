import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL=Deno.env.get("SUPABASE_URL")??"";
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const PUBLIC_ORIGINS=new Set([
  "https://m-commerce-ar.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
]);
function headers(req:Request){
  const origin=req.headers.get("origin")||"https://m-commerce-ar.vercel.app";
  return {"access-control-allow-origin":origin,"access-control-allow-headers":"authorization,apikey,content-type","access-control-allow-methods":"POST,OPTIONS","vary":"origin","cache-control":"no-store"};
}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...headers(req),"content-type":"application/json; charset=utf-8"}})}
const uuid=(v:unknown)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||""));
const cut=(v:unknown,n:number)=>String(v??"").trim().slice(0,n);
async function sha(value:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,"0")).join("")}
function waMessage(order:any,items:any[],body:any){
  const lines=[
    `Pedido #${order.order_number}`,
    "",
    `Cliente: ${cut(body.customer_name,120)}`,
    ...items.map(i=>`${i.quantity} × ${i.product_name}${i.variant_name?" · "+i.variant_name:""} — $${Number(i.line_total).toLocaleString("es-AR")}`),
    "",
    `Entrega: ${body.delivery_method==="delivery"?"Delivery":"Retiro"}`,
    body.delivery_method==="delivery"?`Dirección: ${cut(body.delivery_address,500)}`:"",
    `Forma de pago: ${body.payment_method==="cash"?"Efectivo":"Transferencia"}`,
    `Total: $${Number(order.total).toLocaleString("es-AR")}`
  ].filter(Boolean);
  return lines.join("\n");
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:headers(req)});
  if(req.method!=="POST")return json(req,{error:"METHOD_NOT_ALLOWED"},405);
  if(!URL||!SERVICE)return json(req,{error:"SERVER_NOT_CONFIGURED"},503);
  try{
    const body=await req.json();
    const siteId=String(body?.site_id||""),attempt=String(body?.checkout_attempt_id||"");
    if(!uuid(siteId)||!uuid(attempt))return json(req,{error:"INVALID_REQUEST",message:"Actualizá la página e intentá nuevamente."},422);
    const method=String(body?.payment_method||"cash");
    if(!["cash","transfer","mercadopago"].includes(method))return json(req,{error:"INVALID_PAYMENT_METHOD",message:"Elegí una forma de pago válida."},422);
    const admin=createClient(URL,SERVICE,{auth:{persistSession:false}});
    const {data:site,error:siteError}=await admin.from("sites").select("id,slug,status,is_suspended,subscription_status,custom_domain,domain_status,product_tier").eq("id",siteId).maybeSingle();
    if(siteError)throw siteError;
    if(!site||site.product_tier!=="simple"||site.status!=="published"||site.is_suspended||!["trial","active"].includes(site.subscription_status))return json(req,{error:"SITE_NOT_AVAILABLE",message:"Esta tienda no está disponible en este momento."},403);
    const origin=req.headers.get("origin")||"";
    if(origin){
      const custom=site.domain_status==="connected"?String(site.custom_domain||"").replace(/^https?:\/\//,"").replace(/\/$/,""):"";
      const host=new URL(origin).hostname.toLowerCase();
      if(!PUBLIC_ORIGINS.has(new URL(origin).origin)&&host!==custom.toLowerCase())return json(req,{error:"ORIGIN_NOT_ALLOWED"},403);
    }
    const {data:settings,error:settingsError}=await admin.from("settings").select("whatsapp_number,payment_methods").eq("site_id",siteId).single();
    if(settingsError)throw settingsError;
    if(settings.payment_methods?.[method]!==true)return json(req,{error:"PAYMENT_METHOD_DISABLED",message:"Esa forma de pago no está habilitada."},409);
    if(method==="mercadopago"){
      const forwarded=await fetch(URL+"/functions/v1/checkout-create",{method:"POST",headers:{"content-type":"application/json","apikey":SERVICE,"authorization":"Bearer "+SERVICE,...(origin?{"origin":origin}:{})},body:JSON.stringify(body)});
      return new Response(await forwarded.text(),{status:forwarded.status,headers:{...headers(req),"content-type":"application/json; charset=utf-8"}});
    }
    const customerName=cut(body?.customer_name,120),phone=cut(body?.customer_phone,40),address=cut(body?.delivery_address,500),delivery=body?.delivery_method==="delivery"?"delivery":"pickup";
    const phoneDigits=phone.replace(/\D/g,"");
    if(customerName.length<2)return json(req,{error:"INVALID_CUSTOMER_NAME",message:"Ingresá un nombre válido."},422);
    if(phoneDigits.length<8||phoneDigits.length>15)return json(req,{error:"INVALID_CUSTOMER_PHONE",message:"Ingresá un teléfono válido."},422);
    if(delivery==="delivery"&&address.length<5)return json(req,{error:"DELIVERY_ADDRESS_REQUIRED",message:"Ingresá la dirección de entrega."},422);
    const items=Array.isArray(body?.items)?body.items.slice(0,40).map((x:any)=>({product_id:String(x?.product_id||""),quantity:Number(x?.quantity||0),extra_ids:[],removed_ingredient_ids:[],note:"",variant_id:x?.variant_id?String(x.variant_id):null})):[];
    if(!items.length)return json(req,{error:"INVALID_ITEMS",message:"El carrito está vacío."},422);
    const ip=(req.headers.get("x-forwarded-for")??"unknown").split(",")[0].trim();
    const {data:allowed,error:rateError}=await admin.rpc("checkout_rate_limit_v19",{p_key_hash:await sha(`${ip}|${siteId}|simple-checkout`),p_limit:30});
    if(rateError)throw rateError;if(!allowed)return json(req,{error:"TOO_MANY_REQUESTS",message:"Esperá un minuto antes de volver a intentar."},429);
    const {data:order,error:createError}=await admin.rpc("create_checkout_order_v117",{
      p_customer_name:customerName,p_customer_phone:phone,p_customer_email:"",
      p_delivery_address:address||null,p_delivery_method:delivery,p_notes:cut(body?.notes,1000),
      p_payment_method:"cash",p_site_id:siteId,p_items:items,p_checkout_attempt_id:attempt,
      p_delivery_latitude:null,p_delivery_longitude:null,p_delivery_place_id:null,
      p_delivery_address_formatted:null,p_delivery_address_source:delivery==="delivery"?"manual":null,
      p_delivery_unit:null,p_delivery_instructions:null,p_promotion_code:null,
      p_marketing_opt_in:false,p_redeem_points:false,p_cart_token:null,p_order_source:"simple"
    });
    if(createError)throw createError;
    if(method==="transfer"){
      const {error:updateError}=await admin.from("orders").update({payment_method:"transfer",payment_status:"unpaid",payment_provider:null}).eq("id",order.id).eq("site_id",siteId);
      if(updateError)throw updateError;
    }
    const {data:orderItems,error:itemError}=await admin.from("order_items").select("product_name,variant_name,quantity,line_total").eq("order_id",order.id).eq("site_id",siteId).order("id");
    if(itemError)throw itemError;
    const businessPhone=String(settings.whatsapp_number||"").replace(/\D/g,"");
    const message=waMessage(order,orderItems||[],{...body,payment_method:method});
    try{EdgeRuntime.waitUntil(fetch(URL+"/functions/v1/j3-push",{method:"POST",headers:{"content-type":"application/json","apikey":SERVICE,"authorization":"Bearer "+SERVICE},body:JSON.stringify({order_id:order.id})}))}catch(e){console.warn("push_queue",e)}
    console.log(JSON.stringify({event:"simple_order_created",site_id:siteId,order_id:order.id,order_number:order.order_number,payment_method:method}));
    return json(req,{kind:"whatsapp",idempotent_replay:!!order.idempotent_replay,order,whatsapp_url:businessPhone?`https://wa.me/${businessPhone}?text=${encodeURIComponent(message)}`:null},order.idempotent_replay?200:201);
  }catch(error){
    const raw=error instanceof Error?error.message:String(error);
    console.error(JSON.stringify({event:"simple_checkout_failed",error:raw.slice(0,300)}));
    const map:any={product_not_available:"Uno de los productos ya no está disponible.",insufficient_stock:"No queda stock suficiente.",variant_required:"Elegí una variante.",orders_closed:"El comercio no está recibiendo pedidos."};
    const key=Object.keys(map).find(k=>raw.toLowerCase().includes(k));
    return json(req,{error:"CHECKOUT_FAILED",message:key?map[key]:"No se pudo registrar el pedido. Intentá nuevamente."},400);
  }
});
