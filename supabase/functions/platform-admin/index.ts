import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')??'';
const SERVICE_ROLE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
const ANON=Deno.env.get('SUPABASE_ANON_KEY')??'';
const DEFAULT_PUBLIC=(SUPABASE_URL.replace(/\/+$/,'')==='https://jcgvunffeskkbgsbomgy.supabase.co'?'https://m-commerce-staging.vercel.app':(Deno.env.get('M_COMMERCE_PUBLIC_ORIGIN')||'https://mcommerce.vercel.app')).replace(/\/$/,'');
const LEGACY_PUBLIC='https://j3-plataform.vercel.app';
const LEGACY_ORIGINS=new Set([
  DEFAULT_PUBLIC,
  'https://mcommerce.vercel.app',
  'https://m-commerce-ar.vercel.app',
  LEGACY_PUBLIC,
  'https://j3-plataform-maranata3.vercel.app',
  'https://j3-plataform.joaquinjesusmusic.chatgpt.site'
]);
const RESEND_API_KEY=Deno.env.get('RESEND_API_KEY')??'';
const BREVO_API_KEY=Deno.env.get('BREVO_API_KEY')??'';
const J3_FROM_EMAIL=Deno.env.get('J3_FROM_EMAIL')??'';
const J3_FROM_NAME=Deno.env.get('J3_FROM_NAME')||'M Commerce';
const J3_REPLY_TO=Deno.env.get('J3_REPLY_TO')??'';
const mailTransport=RESEND_API_KEY?'resend':BREVO_API_KEY?'brevo':null;
const customMailReady=Boolean(mailTransport&&J3_FROM_EMAIL);

function cors(req:Request){
  const origin=req.headers.get('origin')||DEFAULT_PUBLIC;
  const allowed=LEGACY_ORIGINS.has(origin)||origin==='http://localhost'||origin.startsWith('http://localhost:');
  return {'Access-Control-Allow-Origin':allowed?origin:DEFAULT_PUBLIC,'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
}
function json(req:Request,b:unknown,status=200){return new Response(JSON.stringify(b),{status,headers:{...cors(req),'content-type':'application/json','cache-control':'no-store'}})}
async function requireMaster(req:Request){const auth=req.headers.get('authorization')||'';if(!auth.startsWith('Bearer '))throw new Error('AUTH_REQUIRED');const userClient=createClient(SUPABASE_URL,ANON,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});const {data:{user},error}=await userClient.auth.getUser();if(error||!user)throw new Error('AUTH_REQUIRED');const {data:profile,error:pErr}=await userClient.from('profiles').select('role').eq('id',user.id).maybeSingle();if(pErr||profile?.role!=='admin')throw new Error('ADMIN_REQUIRED');return user}
async function findUser(admin:any,email:string){for(let page=1;page<=100;page++){const result=await admin.auth.admin.listUsers({page,perPage:1000});if(result.error)throw result.error;const found=result.data.users.find((u:any)=>u.email?.toLowerCase()===email.toLowerCase());if(found)return found;if(result.data.users.length<1000)return null;}throw new Error('USER_LOOKUP_LIMIT_REACHED')}
function esc(v:string){return String(v||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]||m))}
function mailCopy(kind:'invite'|'seller'|'recovery',name:string,business:string){const who=name?`Hola ${esc(name)},`:'Hola,';if(kind==='recovery')return {subject:'Restablecé tu contraseña · M Commerce',eyebrow:'SEGURIDAD DE CUENTA',title:'Creá una nueva contraseña',body:`${who} recibimos una solicitud para restablecer la contraseña de tu acceso a M Commerce.`,button:'RESTABLECER CONTRASEÑA',foot:'Si vos no solicitaste este cambio, podés ignorar este correo.'};if(kind==='seller')return {subject:'Tu acceso comercial · M Commerce',eyebrow:'ACCESO COMERCIAL',title:'Activá tu acceso a M Commerce',body:`${who} te habilitaron un acceso comercial a M Commerce.`,button:'CREAR MI CONTRASEÑA',foot:'Este enlace es personal. No lo compartas.'};return {subject:`Tu Panel de Comercio ya está listo · ${business||'M Commerce'}`,eyebrow:'ACCESO DEL COMERCIO',title:'Tu Panel de Comercio está listo',body:`${who} ya tenés acceso${business?` para administrar <strong>${esc(business)}</strong>`:''}.<br><br><strong>1.</strong> Creá tu contraseña.<br><strong>2.</strong> M Commerce abre tu Panel de Comercio.<br><strong>3.</strong> Tocá <strong>Instalar Panel</strong> para dejar la aplicación en tu PC.`,button:'CREAR CONTRASEÑA Y ABRIR PANEL',foot:'Las próximas mejoras del panel se reciben desde M Commerce, sin descargar archivos ni ZIPs.'}}
function mailHtml(copy:ReturnType<typeof mailCopy>,link:string){return `<!doctype html><html><body style="margin:0;background:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#111827"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f5f8"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px"><tr><td bgcolor="#080b14" style="padding:28px 32px;background-color:#080b14;color:#ffffff"><span style="font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:28px;color:#ffffff;font-weight:900">M COMMERCE</span><br><span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:18px;color:#a9b2c3">${copy.eyebrow}</span></td></tr><tr><td style="padding:34px 32px"><h1 style="font-family:Arial,Helvetica,sans-serif;font-size:25px;line-height:30px;color:#111827;margin:0 0 16px">${copy.title}</h1><p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:25px;color:#4b5563;margin:0 0 26px">${copy.body}</p><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#111827" style="background-color:#111827;border-radius:10px"><a href="${esc(link)}" style="display:inline-block;padding:14px 21px;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;font-weight:800">${copy.button}</a></td></tr></table><p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#6b7280;margin:28px 0 0">${copy.foot}</p><p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;color:#9ca3af;margin:14px 0 0;word-break:break-all">${esc(link)}</p></td></tr></table></td></tr></table></body></html>`}
async function sendJ3Mail(to:string,kind:'invite'|'seller'|'recovery',link:string,name='',business=''){
 if(!customMailReady)throw new Error('J3_MAIL_NOT_CONFIGURED');
 const copy=mailCopy(kind,name,business);
 const payload:any={from:`${J3_FROM_NAME} <${J3_FROM_EMAIL}>`,to:[to],subject:copy.subject,html:mailHtml(copy,link)};
 if(J3_REPLY_TO)payload.reply_to=J3_REPLY_TO;
 let response:Response;
 const brevoPayload:any={sender:{name:J3_FROM_NAME,email:J3_FROM_EMAIL},to:[{email:to}],subject:copy.subject,htmlContent:payload.html};
 if(J3_REPLY_TO)brevoPayload.replyTo={email:J3_REPLY_TO};
 try{response=await fetch(mailTransport==='brevo'?'https://api.brevo.com/v3/smtp/email':'https://api.resend.com/emails',{method:'POST',headers:mailTransport==='brevo'?{'api-key':BREVO_API_KEY,'content-type':'application/json'}:{authorization:`Bearer ${RESEND_API_KEY}`,'content-type':'application/json'},body:JSON.stringify(mailTransport==='brevo'?brevoPayload:payload),signal:AbortSignal.timeout(8000)});}catch{throw new Error('J3_MAIL_UNAVAILABLE');}
 if(!response.ok)throw new Error('J3_MAIL_SEND_FAILED');
 const out=await response.json().catch(()=>null);
 const messageId=mailTransport==='brevo'?out?.messageId:out?.id;
 if(typeof messageId!=='string'||!messageId.trim())throw new Error('J3_MAIL_INVALID_RESPONSE');
 return out;
}
function tokenHash(g:any){return g?.data?.properties?.hashed_token||g?.data?.properties?.hashedToken||g?.data?.properties?.token_hash||''}
function directLink(g:any,type:'invite'|'recovery',mode:'invite'|'recovery'|'seller',siteId?:string){const hash=tokenHash(g);if(!hash)throw new Error('J3_AUTH_TOKEN_MISSING');const u=new URL(DEFAULT_PUBLIC+'/auth');u.searchParams.set('mode',mode);u.searchParams.set('type',type);u.searchParams.set('token_hash',hash);if(siteId)u.searchParams.set('site',siteId);if(mode==='invite'&&siteId)u.searchParams.set('install','1');return u.toString()}

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});
 if(req.method!=='POST')return json(req,{error:'METHOD_NOT_ALLOWED'},405);
 try{
  const master=await requireMaster(req);const body=await req.json();const action=String(body?.action||'');const email=String(body?.email||'').trim().toLowerCase();const fullName=String(body?.full_name||'').trim();const admin=createClient(SUPABASE_URL,SERVICE_ROLE,{auth:{persistSession:false}});
  if(action==='mail_status')return json(req,{ok:true,provider:customMailReady?'j3':'manual_link',transport:customMailReady?mailTransport:null,sender_name:J3_FROM_NAME,sender_domain:J3_FROM_EMAIL.includes('@')?J3_FROM_EMAIL.split('@')[1]:null,canonical_origin:DEFAULT_PUBLIC});
  if(action==='seller_invite'){
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json(req,{error:'INVALID_EMAIL',message:'Ingresá un email válido.'},422);
    const u=await findUser(admin,email);const existing=Boolean(u);const type:'invite'|'recovery'=existing?'recovery':'invite';
    const generated=existing?await admin.auth.admin.generateLink({type:'recovery',email}):await admin.auth.admin.generateLink({type:'invite',email,options:{data:{full_name:fullName,portal:'seller'}}});if(generated.error)throw generated.error;
    const userId=generated.data?.user?.id||u?.id||null;if(!userId)throw new Error('USER_NOT_CREATED');const link=directLink(generated,type,existing?'recovery':'seller');
    if(customMailReady)await sendJ3Mail(email,existing?'recovery':'seller',link,fullName,'');
    const upd=await admin.from('salespeople').update({user_id:userId,full_name:fullName||undefined,updated_at:new Date().toISOString()}).eq('email',email);if(upd.error)throw upd.error;
    return json(req,{ok:true,existing_user:existing,email,mail_provider:customMailReady?'j3':'manual_link',delivery:customMailReady?'email':'manual_link',access_link:customMailReady?null:link});
  }
  const siteId=String(body?.site_id||'');if(!/^[0-9a-f-]{36}$/i.test(siteId))return json(req,{error:'INVALID_SITE'},422);
  const site=await admin.from('sites').select('id,name').eq('id',siteId).maybeSingle();if(site.error)throw site.error;if(!site.data)throw new Error('SITE_ACCESS_DENIED');
  if(action==='delete_preview'){const preview=await admin.rpc('platform_delete_site_preview',{p_site_id:siteId});if(preview.error)throw preview.error;return json(req,preview.data)}
  if(action==='delete_site'){
    const confirmName=String(body?.confirm_name||'');const confirmPhrase=String(body?.confirm_phrase||'');
    const assets=await admin.from('site_assets').select('storage_bucket,storage_path').eq('site_id',siteId);if(assets.error)throw assets.error;
    const deletion=await admin.rpc('platform_delete_site',{p_site_id:siteId,p_confirm_name:confirmName,p_confirm_phrase:confirmPhrase,p_actor_id:master.id});if(deletion.error)throw deletion.error;
    const grouped=new Map<string,string[]>();for(const row of assets.data||[]){if(!row.storage_bucket||!row.storage_path)continue;const list=grouped.get(row.storage_bucket)||[];list.push(row.storage_path);grouped.set(row.storage_bucket,list)}
    const storageWarnings:string[]=[];for(const [bucket,paths] of grouped){const removed=await admin.storage.from(bucket).remove(paths);if(removed.error)storageWarnings.push(bucket+': '+removed.error.message)}
    return json(req,{ok:true,deletion:deletion.data,storage_cleanup:storageWarnings.length?'pending':'complete',warnings:storageWarnings});
  }
  if(action==='invite'){
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json(req,{error:'INVALID_EMAIL',message:'Ingresá un email válido.'},422);
    const u=await findUser(admin,email);const existing=Boolean(u);const type:'invite'|'recovery'=existing?'recovery':'invite';
    const generated=existing?await admin.auth.admin.generateLink({type:'recovery',email}):await admin.auth.admin.generateLink({type:'invite',email,options:{data:{full_name:fullName,site_id:siteId,merchant_role:'merchant_owner'}}});if(generated.error)throw generated.error;
    const userId=generated.data?.user?.id||u?.id||null;if(!userId)throw new Error('USER_NOT_CREATED');const link=directLink(generated,type,existing?'recovery':'invite',siteId);
    const membership=await admin.rpc('platform_assign_site_owner',{p_site_id:siteId,p_user_id:userId,p_email:email,p_full_name:fullName});if(membership.error)throw membership.error;
    if(customMailReady)await sendJ3Mail(email,existing?'recovery':'invite',link,fullName,site.data.name||'');
    return json(req,{ok:true,existing_user:existing,email,site_id:siteId,mail_provider:customMailReady?'j3':'manual_link',delivery:customMailReady?'email':'manual_link',access_link:link,canonical_origin:DEFAULT_PUBLIC});
  }
  if(action==='recovery'){
    if(!email)return json(req,{error:'EMAIL_REQUIRED'},422);
    const generated=await admin.auth.admin.generateLink({type:'recovery',email});if(generated.error)throw generated.error;const link=directLink(generated,'recovery','recovery',siteId);
    if(customMailReady)await sendJ3Mail(email,'recovery',link,fullName,site.data.name||'');
    return json(req,{ok:true,mail_provider:customMailReady?'j3':'manual_link',delivery:customMailReady?'email':'manual_link',access_link:link,canonical_origin:DEFAULT_PUBLIC});
  }
  return json(req,{error:'INVALID_ACTION'},422);
 }catch(e){console.error('platform-admin',e);const m=e instanceof Error?e.message:(e&&typeof e==='object'&&'message' in e?String(e.message):String(e));const messages:Record<string,string>={ADMIN_REQUIRED:'No tenés permiso de Panel Maestro.',AUTH_REQUIRED:'Iniciá sesión de nuevo.',OWNER_ALREADY_ASSIGNED_TO_ANOTHER_SITE:'Ese email ya administra otro comercio. Usá una cuenta distinta para el dueño de esta tienda.',MASTER_CANNOT_BE_MERCHANT:'Una cuenta Maestro no puede ser dueña de un comercio.',USER_EMAIL_MISMATCH:'El usuario y el email no coinciden. Revisá el acceso antes de volver a intentar.'};return json(req,{error:m,message:messages[m]||'No se pudo completar la acción: '+m},m==='AUTH_REQUIRED'?401:m==='ADMIN_REQUIRED'?403:400)}
});

