// deno-lint-ignore-file no-import-prefix
// Pinned imports also support deployment through the dashboard editor.
import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
const project=Deno.env.get('SUPABASE_URL')||'',secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const origins=new Set(['https://mcommerce.vercel.app','https://m-commerce-ar.vercel.app','http://localhost:3000','http://127.0.0.1:3000']);
const configuredOrigin=Deno.env.get('M_COMMERCE_PUBLIC_ORIGIN')?.replace(/\/+$/,'');
if(configuredOrigin)origins.add(configuredOrigin);
const clean=(value:unknown,max:number)=>String(value??'').trim().slice(0,max);
function customHostname(origin:string){try{const url=new URL(origin);return url.protocol==='https:'&&!url.port&&url.origin===origin?url.hostname.toLowerCase():null;}catch{return null;}}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'';
 const cors={'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://mcommerce.vercel.app','Access-Control-Allow-Headers':'content-type,apikey,authorization','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(req.method==='OPTIONS'){
  if(origin&&!origins.has(origin)){
   const host=customHostname(origin);if(!host)return reply({message:'Origen no permitido.'},403);
   if(!project||!secret)return reply({message:'Canal temporalmente fuera de servicio.'},503);
   try{
    const check=await createClient(project,secret,{auth:{persistSession:false}}).from('sites').select('id').eq('custom_domain',host).eq('domain_status','connected').limit(1).maybeSingle();
    if(check.error)return reply({message:'Canal temporalmente fuera de servicio.'},503);
    if(!check.data)return reply({message:'Origen no permitido.'},403);
    cors['Access-Control-Allow-Origin']=origin;
   }catch{return reply({message:'Canal temporalmente fuera de servicio.'},503);}
  }
  return new Response(null,{headers:cors});
 }
 if(req.method!=='POST')return reply({message:'Método no permitido.'},405);
 if(!project||!secret)return reply({message:'El canal está temporalmente fuera de servicio. Contactá al vendedor por sus medios publicados.'},503);
 try{
  if(Number(req.headers.get('content-length')||0)>12000)return reply({message:'La solicitud es demasiado extensa.'},413);
  const raw=await req.text();if(raw.length>12000)return reply({message:'La solicitud es demasiado extensa.'},413);
  const body=JSON.parse(raw),admin=createClient(project,secret,{auth:{persistSession:false}});
  const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim();
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('consumer-request|'+ip));
  const hash=[...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
  const limit=await admin.rpc('checkout_rate_limit_v19',{p_key_hash:hash,p_limit:15});
  if(limit.error)throw limit.error;if(!limit.data)return reply({message:'Recibimos varias solicitudes desde esta conexión. Esperá un minuto o usá el contacto publicado.'},429);
  const name=clean(body.name,120),email=clean(body.email,254),kind=clean(body.kind,30);
  if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply({message:'Ingresá tu nombre y un email válido para poder responderte.'},422);
  if(!['withdrawal','complaint','service_cancellation','privacy','technical'].includes(kind))return reply({message:'Elegí el tipo de solicitud.'},422);
  let siteId:string|null=null;
  const slug=clean(body.slug,100);
  if(slug){const store=await admin.from('sites').select('id,custom_domain,domain_status').eq('slug',slug).maybeSingle();if(store.error)throw store.error;if(!store.data)return reply({message:'No pudimos identificar el comercio. Revisá el enlace.'},404);siteId=store.data.id;
   if(origin&&!origins.has(origin)){
    if(!(store.data.domain_status==='connected'&&customHostname(origin)===String(store.data.custom_domain||'').toLowerCase()))return reply({message:'Origen no permitido.'},403);
    cors['Access-Control-Allow-Origin']=origin;
   }
  }else if(origin&&!origins.has(origin))return reply({message:'Origen no permitido.'},403);
  // Persist only intake data. Never disclose, cancel, refund or change another person's order.
  const inserted=await admin.from('simple_consumer_requests').insert({site_id:siteId,kind,customer_name:name,email,phone:clean(body.phone,40),order_reference:clean(body.order_reference,100),message:clean(body.message,5000)}).select('request_code,created_at').single();
  if(inserted.error)throw inserted.error;
  return reply({code:inserted.data.request_code,created_at:inserted.data.created_at,message:'Solicitud registrada. Conservá este código. Será atendida por el vendedor si corresponde a una compra, o por M Commerce si corresponde a su servicio.'},201);
 }catch(error){console.error('consumer_request_error',{request_id:crypto.randomUUID(),code:String((error as {code?:string})?.code||'INTERNAL_ERROR')});return reply({message:'No pudimos registrar la solicitud. Intentá nuevamente o usá el contacto publicado.'},400);}
});
