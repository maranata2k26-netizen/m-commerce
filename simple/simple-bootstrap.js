(()=>{"use strict";
const OFFICIAL_ORIGIN=String(window.M_COMMERCE_OFFICIAL_ORIGIN||"https://m-commerce-ar.vercel.app").replace(/\/+$/,"");
const PROJECT_URL="https://kjoixhzaxopdbmudzfsg.supabase.co";
const PREVIEW=new URLSearchParams(location.search).get("preview")==="1";
const DEVICE=new URLSearchParams(location.search).get("device")||"desktop";
let client=null;

function safeClone(value){try{return structuredClone(value)}catch{return JSON.parse(JSON.stringify(value))}}
function official(path){return OFFICIAL_ORIGIN+path}

const originalCreate=window.supabase?.createClient?.bind(window.supabase);
if(!originalCreate)return;

window.supabase.createClient=(url,key,options)=>{
  const sb=originalCreate(url,key,options);
  client=sb;
  window.__mcSimpleClient=sb;

  const originalRpc=sb.rpc.bind(sb);
  sb.rpc=async(name,args={},opts)=>{
    if(name==="simple_my_store"){
      return originalRpc("simple_ensure_store",{},opts);
    }
    if(name==="simple_public_storefront"&&PREVIEW){
      return originalRpc("simple_preview_storefront",{p_slug:args?.p_slug},opts);
    }
    if(name==="simple_save_store_profile"){
      const result=await originalRpc(name,args,opts);
      if(!result.error&&args?.p_site_id&&args?.p_profile?.business_name){
        const identity=await originalRpc("simple_update_draft_identity",{p_site_id:args.p_site_id,p_name:args.p_profile.business_name});
        if(identity.error)console.warn("simple_update_draft_identity",identity.error);
      }
      return result;
    }
    if(name==="simple_dashboard"){
      const result=await originalRpc(name,args,opts);
      if(!result.error&&result.data){
        window.__mcSimpleActualDashboard=safeClone(result.data);
        result.data.subscription=result.data.subscription||{};
        result.data.subscription.actual_status=result.data.subscription.status||result.data.site?.subscription_status||"pending";
        result.data.site.actual_subscription_status=result.data.site?.subscription_status||result.data.subscription.actual_status;
        // El propietario puede terminar onboarding, editar y previsualizar aunque el plan aún esté pendiente.
        // La publicación real sigue protegida en backend por simple_publish_store().
        if(!["trial","active","buyout"].includes(String(result.data.subscription.status||""))){
          result.data.subscription.status="trial";
          if(result.data.site)result.data.site.subscription_status="trial";
        }
      }
      return result;
    }
    return originalRpc(name,args,opts);
  };

  const realSignUp=sb.auth.signUp.bind(sb.auth);
  sb.auth.signUp=(credentials)=>realSignUp({
    ...credentials,
    options:{...(credentials?.options||{}),emailRedirectTo:official("/simple/app?verified=1")}
  });

  const realReset=sb.auth.resetPasswordForEmail.bind(sb.auth);
  sb.auth.resetPasswordForEmail=(email,options={})=>realReset(email,{...options,redirectTo:official("/simple/app?reset=1")});

  return sb;
};

function injectStyle(){
  if(document.getElementById("mc-simple-flow-style"))return;
  const style=document.createElement("style");
  style.id="mc-simple-flow-style";
  style.textContent=`
    .mc-owner-tools{margin:18px 0;padding:20px;border:1px solid rgba(15,23,42,.12);border-radius:18px;background:#fff;box-shadow:0 10px 35px rgba(15,23,42,.06)}
    .mc-owner-tools h2{margin:0 0 8px}.mc-owner-tools p{margin:6px 0 14px}.mc-owner-actions{display:flex;flex-wrap:wrap;gap:10px}.mc-owner-actions .btn{min-height:44px}
    .mc-welcome{padding:14px 16px;margin:0 0 16px;border-radius:14px;background:#eef4ff;border:1px solid #d9e7ff}.mc-welcome strong{display:block;font-size:1.05rem;margin-bottom:4px}
    .mc-preview-bar{position:fixed;z-index:99999;top:0;left:0;right:0;min-height:54px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 14px;background:#0b1220;color:#fff;box-shadow:0 4px 18px rgba(0,0,0,.22)}
    .mc-preview-bar a,.mc-preview-bar button{color:#fff;background:#1d4ed8;border:0;border-radius:9px;padding:9px 12px;text-decoration:none;font:inherit;cursor:pointer}.mc-preview-bar small{opacity:.78}
    body.mc-preview{padding-top:54px;background:#e8edf4}.mc-preview-frame{min-height:calc(100vh - 54px);margin:0 auto;background:#fff;box-shadow:0 0 30px rgba(15,23,42,.12)}
    body.mc-preview-mobile .store{max-width:430px;margin:0 auto;min-height:calc(100vh - 54px);background:#fff;box-shadow:0 0 30px rgba(15,23,42,.15)}
    @media(max-width:620px){.mc-owner-actions{display:grid;grid-template-columns:1fr}.mc-owner-actions .btn{width:100%}}
  `;
  document.head.appendChild(style);
}

function previewChrome(){
  if(!PREVIEW||document.querySelector(".mc-preview-bar"))return;
  injectStyle();
  document.body.classList.add("mc-preview",DEVICE==="mobile"?"mc-preview-mobile":"mc-preview-desktop");
  const bar=document.createElement("div");
  bar.className="mc-preview-bar";
  bar.innerHTML=`<div><strong>Vista previa real</strong><br><small>${DEVICE==="mobile"?"Celular":"PC"} · solo vos podés verla mientras esté en borrador</small></div><a href="${official("/simple/app")}">Volver al panel</a>`;
  document.body.prepend(bar);
}

async function startBilling(siteId){
  const session=(await client.auth.getSession()).data.session;
  if(!session)throw new Error("Tu sesión venció. Volvé a ingresar.");
  const res=await fetch(PROJECT_URL+"/functions/v1/j3-billing",{
    method:"POST",
    headers:{"content-type":"application/json","apikey":"sb_publishable_G9dKTg3ev1183qjfVkqMXg_kp5WDPaq","authorization":"Bearer "+session.access_token},
    body:JSON.stringify({action:"subscription_create",site_id:siteId,return_path:"/simple/app?billing_return=1&publish_after_billing=1"})
  });
  const out=await res.json();
  if(!res.ok)throw new Error(out.message||out.error||"No se pudo activar el plan.");
  const target=out.checkout_url||out.init_point;
  if(!target)throw new Error("Mercado Pago no devolvió el enlace de activación.");
  location.href=target;
}

async function publishNow(dash,button){
  if(!client||!dash?.site?.id)return;
  const actual=String(dash.subscription?.status||dash.site.subscription_status||"pending");
  if(!["trial","active","buyout"].includes(actual)){
    if(button){button.disabled=true;button.textContent="Abriendo activación…"}
    try{return await startBilling(dash.site.id)}finally{if(button){button.disabled=false;button.textContent="PUBLICAR MI TIENDA"}}
  }
  if(button){button.disabled=true;button.textContent="Publicando…"}
  try{
    const {data,error}=await client.rpc("simple_publish_store",{p_site_id:dash.site.id});
    if(error)throw error;
    if(!data?.published){throw new Error("Falta completar: "+((data?.missing||[]).join(", ")||"configuración mínima"));}
    location.href=official("/simple/app?published=1");
  }catch(e){
    alert(e?.message||"No se pudo publicar la tienda.");
    if(button){button.disabled=false;button.textContent="PUBLICAR MI TIENDA"}
  }
}

function enhanceWizard(dash){
  const wizard=document.querySelector("form#wizard");
  if(!wizard||wizard.querySelector(".mc-welcome"))return;
  const box=document.createElement("div");
  box.className="mc-welcome";
  box.innerHTML="<strong>¡Bienvenido a M Commerce!</strong><span>Vamos a crear tu tienda. Ya preparamos un borrador privado para vos; completá estos pasos y después vas a poder previsualizarlo antes de publicarlo.</span>";
  wizard.prepend(box);
}

function enhanceDashboard(dash){
  if(!dash?.site?.simple_onboarding_completed_at)return;
  const host=document.querySelector(".app-main");
  if(!host||document.getElementById("mc-owner-tools"))return;
  const card=document.createElement("section");
  card.id="mc-owner-tools";
  card.className="mc-owner-tools";
  const site=dash.site;
  const subStatus=String(dash.subscription?.status||site.subscription_status||"pending");
  const published=site.status==="published";
  const publicUrl=official("/tienda/"+encodeURIComponent(site.slug));
  card.innerHTML=`
    <div class="eyebrow">Estado de tu tienda</div>
    <h2>${published?"Tu tienda está online":"Tu tienda está en borrador"}</h2>
    <p class="muted">${published?"Los clientes ya pueden verla y comprar.":"Solo vos podés verla hasta tocar PUBLICAR MI TIENDA."} ${!["trial","active","buyout"].includes(subStatus)?"Al publicar te vamos a pedir activar el plan.":""}</p>
    <div class="mc-owner-actions">
      <a class="btn secondary" target="_blank" rel="noopener" href="${publicUrl}?preview=1&device=mobile">Vista previa celular</a>
      <a class="btn secondary" target="_blank" rel="noopener" href="${publicUrl}?preview=1&device=desktop">Vista previa PC</a>
      ${published?`<a class="btn brand" target="_blank" rel="noopener" href="${publicUrl}">ABRIR MI TIENDA</a><button class="btn secondary" type="button" id="mc-copy-link">COPIAR LINK</button><button class="btn secondary" type="button" id="mc-share-link">COMPARTIR</button>`:`<button class="btn brand" type="button" id="mc-publish">PUBLICAR MI TIENDA</button>`}
    </div>`;
  const welcome=host.querySelector(".welcome");
  const stats=host.querySelector(".stats");
  (stats||welcome)?.after(card);
  const publish=document.getElementById("mc-publish");
  if(publish)publish.onclick=()=>publishNow(dash,publish);
  const copy=document.getElementById("mc-copy-link");
  if(copy)copy.onclick=async()=>{await navigator.clipboard.writeText(publicUrl);copy.textContent="LINK COPIADO"};
  const share=document.getElementById("mc-share-link");
  if(share)share.onclick=async()=>{if(navigator.share)await navigator.share({title:site.name,url:publicUrl});else{await navigator.clipboard.writeText(publicUrl);share.textContent="LINK COPIADO"}};
}

async function maybeFinishPublish(dash){
  const q=new URLSearchParams(location.search);
  if(q.get("publish_after_billing")!=="1"||dash?.site?.status==="published")return;
  const actual=String(dash?.subscription?.status||dash?.site?.subscription_status||"pending");
  if(!["trial","active","buyout"].includes(actual))return;
  const key="mc-publish-after-billing:"+dash.site.id;
  if(sessionStorage.getItem(key))return;
  sessionStorage.setItem(key,"1");
  await publishNow(dash,null);
}

function enhance(){
  previewChrome();
  const dash=window.__mcSimpleActualDashboard;
  if(!dash)return;
  if(!dash.site?.simple_onboarding_completed_at)enhanceWizard(dash);
  else{
    enhanceDashboard(dash);
    maybeFinishPublish(dash).catch(console.error);
  }
}

injectStyle();
new MutationObserver(enhance).observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener("DOMContentLoaded",enhance);
})();