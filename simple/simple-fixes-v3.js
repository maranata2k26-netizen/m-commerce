(()=>{
  "use strict";

  const PROJECT_URL="https://kjoixhzaxopdbmudzfsg.supabase.co";
  const API_KEY="sb_publishable_G9dKTg3ev1183qjfVkqMXg_kp5WDPaq";
  const OFFICIAL_ORIGIN=String(window.M_COMMERCE_OFFICIAL_ORIGIN||"https://m-commerce-ar.vercel.app").replace(/\/+$/,"");
  const q=new URLSearchParams(location.search);
  const PREVIEW=q.get("preview")==="1";
  const DEVICE=q.get("device")||"desktop";

  function client(){return window.__mcSimpleClient||null;}
  function dash(){return window.__mcSimpleActualDashboard||null;}

  function toast(message,bad=false){
    let el=document.getElementById("mc-fixes-toast");
    if(!el){
      el=document.createElement("div");
      el.id="mc-fixes-toast";
      document.body.appendChild(el);
    }
    el.textContent=message;
    el.classList.toggle("bad",bad);
    el.classList.add("show");
    clearTimeout(el._timer);
    el._timer=setTimeout(()=>el.classList.remove("show"),3200);
  }

  function injectStyles(){
    if(document.getElementById("mc-simple-fixes-v3-style"))return;
    const style=document.createElement("style");
    style.id="mc-simple-fixes-v3-style";
    style.textContent=`
      #mc-fixes-toast{position:fixed;z-index:100500;left:50%;bottom:22px;transform:translate(-50%,120px);max-width:min(92vw,520px);padding:12px 16px;border-radius:12px;background:#0b1220;color:#fff;font-weight:750;box-shadow:0 16px 40px rgba(0,0,0,.24);transition:.2s}
      #mc-fixes-toast.show{transform:translate(-50%,0)}#mc-fixes-toast.bad{background:#991b2b}

      .upload-grid{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:16px!important;align-items:start}
      .upload-grid>.field,.field:has(>input[type=file]){min-width:0}
      input[type=file]{display:block;width:100%;max-width:100%;min-width:0;overflow:hidden;border:1px solid #ccd3dd!important;border-radius:12px!important;background:#fff!important;padding:7px!important;min-height:46px;color:#667085}
      input[type=file]::file-selector-button{border:0;border-radius:9px;padding:9px 12px;margin-right:10px;background:#eef2ff;color:#26304d;font-weight:850;cursor:pointer}
      input[type=file]:hover::file-selector-button{background:#e3e8ff}
      @media(max-width:720px){.upload-grid{grid-template-columns:1fr!important}}

      .mc-inline-category{margin-top:9px;padding:11px;border:1px solid #e6eaf0;border-radius:12px;background:#fafbff}
      .mc-inline-category-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      .mc-inline-category input{flex:1 1 190px;min-width:0;border:1px solid #ccd3dd;border-radius:10px;padding:10px 11px}
      .mc-inline-category .mini{white-space:nowrap}
      .mc-category-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}

      body.mc-preview-mobile{overflow-x:hidden}
      body.mc-preview-mobile .store{width:min(390px,100%)!important;max-width:390px!important;margin:0 auto!important;overflow-x:hidden!important}
      body.mc-preview-mobile .store-cover{height:135px!important}
      body.mc-preview-mobile .store-info{padding:0 14px 20px!important;gap:12px!important;min-width:0!important}
      body.mc-preview-mobile .store-info>div{min-width:0!important}
      body.mc-preview-mobile .store-info h1{font-size:28px!important;overflow-wrap:anywhere}
      body.mc-preview-mobile .store-info p{overflow-wrap:anywhere}
      body.mc-preview-mobile .store-logo{width:76px!important;height:76px!important;border-radius:20px!important;flex:none}
      body.mc-preview-mobile .catalog{width:100%!important;max-width:100%!important;padding:16px 14px 110px!important;overflow-x:hidden!important}
      body.mc-preview-mobile .category-tabs{max-width:100%!important}
      body.mc-preview-mobile .products,
      body.mc-preview-mobile .store.mc-preset-store .products{grid-template-columns:minmax(0,1fr)!important;width:100%!important;max-width:100%!important}
      body.mc-preview-mobile .product{width:100%!important;max-width:100%!important;min-width:0!important}
      body.mc-preview-mobile .store.mc-layout-horizontal .product{display:block!important}
      body.mc-preview-mobile .store.mc-layout-horizontal .product img,
      body.mc-preview-mobile .product img{width:100%!important;max-width:100%!important;height:auto!important;min-height:0!important;aspect-ratio:4/3!important;object-fit:cover!important}
      body.mc-preview-mobile .product-body{min-width:0!important}
      body.mc-preview-mobile .product-foot{min-width:0!important;flex-wrap:wrap!important}
      body.mc-preview-mobile .add{max-width:100%!important}
      body.mc-preview-mobile .cart-bar{width:min(362px,calc(100% - 28px))!important}
    `;
    document.head.appendChild(style);
  }

  async function reloadCategories(select,selectedName=""){
    const c=client(),siteId=dash()?.site?.id;
    if(!c||!siteId)return;
    const {data,error}=await c.from("product_categories").select("id,name").eq("site_id",siteId).eq("active",true).order("sort_order");
    if(error)throw error;
    const rows=data||[];
    const old=select.value;
    select.innerHTML='<option value="">Elegí una</option>'+rows.map(cat=>`<option value="${String(cat.id).replace(/"/g,"&quot;")}" data-name="${String(cat.name).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]))}">${String(cat.name).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]))}</option>`).join("");
    const byName=rows.find(cat=>cat.name.trim().toLowerCase()===selectedName.trim().toLowerCase());
    select.value=byName?.id||old||"";
  }

  function enhanceCategoryCreator(){
    const select=document.querySelector("#product-edit #p_category");
    if(!select||select.dataset.mcQuickCategory)return;
    select.dataset.mcQuickCategory="1";
    const field=select.closest(".field");
    if(!field)return;

    const tools=document.createElement("div");
    tools.className="mc-category-tools";
    tools.innerHTML='<button type="button" class="mini" id="mc-quick-category">+ Nueva categoría</button><span class="hint">Podés crearla sin salir del producto.</span>';
    field.appendChild(tools);

    tools.querySelector("#mc-quick-category").onclick=()=>{
      if(field.querySelector(".mc-inline-category"))return field.querySelector(".mc-inline-category input")?.focus();
      const box=document.createElement("div");
      box.className="mc-inline-category";
      box.innerHTML='<div class="mc-inline-category-actions"><input type="text" maxlength="80" placeholder="Nombre de la categoría" aria-label="Nombre de la nueva categoría"><button type="button" class="mini mc-save-category">Guardar</button><button type="button" class="mini mc-cancel-category">Cancelar</button></div>';
      field.appendChild(box);
      const input=box.querySelector("input");
      input.focus();
      box.querySelector(".mc-cancel-category").onclick=()=>box.remove();
      box.querySelector(".mc-save-category").onclick=async ev=>{
        const name=input.value.trim();
        if(!name)return toast("Escribí el nombre de la categoría.",true);
        const c=client(),siteId=dash()?.site?.id;
        if(!c||!siteId)return toast("No pudimos identificar la tienda.",true);
        const btn=ev.currentTarget;
        btn.disabled=true;btn.textContent="Guardando…";
        try{
          const {error}=await c.rpc("simple_upsert_category",{p_site_id:siteId,p_category:{name,active:true}});
          if(error)throw error;
          await reloadCategories(select,name);
          box.remove();
          toast("Categoría creada y seleccionada.");
        }catch(error){
          toast(error?.message||"No se pudo crear la categoría.",true);
          btn.disabled=false;btn.textContent="Guardar";
        }
      };
      input.addEventListener("keydown",ev=>{if(ev.key==="Enter"){ev.preventDefault();box.querySelector(".mc-save-category").click();}});
    };
  }

  async function billingRequest(action,siteId,extra={}){
    const c=client();
    if(!c)throw new Error("No se pudo iniciar la sesión de M Commerce.");
    const {data:{session}}=await c.auth.getSession();
    if(!session)throw new Error("Tu sesión venció. Volvé a ingresar.");
    const res=await fetch(PROJECT_URL+"/functions/v1/j3-billing",{
      method:"POST",
      headers:{"content-type":"application/json","apikey":API_KEY,"authorization":"Bearer "+session.access_token},
      body:JSON.stringify({action,site_id:siteId,payer_email:session.user?.email||"",...extra})
    });
    const out=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(out.message||out.error||"No se pudo procesar la activación.");
    return out;
  }

  async function publishFixed(button){
    const c=client(),d=dash();
    if(!c||!d?.site?.id)return toast("No se pudo identificar la tienda.",true);
    const siteId=d.site.id;
    const actual=String(d.subscription?.actual_status||d.site?.actual_subscription_status||d.subscription?.status||d.site?.subscription_status||"pending");
    button.disabled=true;
    try{
      if(!["trial","active","buyout"].includes(actual)){
        button.textContent="Abriendo activación…";
        sessionStorage.setItem("mc-publish-intent:"+siteId,"1");
        const out=await billingRequest("subscription_create",siteId,{return_path:"/simple/app?billing_return=1&publish_after_billing=1&site="+encodeURIComponent(siteId)});
        const target=out.checkout_url||out.init_point;
        if(!target)throw new Error("Mercado Pago no devolvió el enlace de activación.");
        location.href=target;
        return;
      }

      button.textContent="Publicando…";
      const {data,error}=await c.rpc("simple_publish_store",{p_site_id:siteId});
      if(error)throw error;
      if(!data?.published)throw new Error("Falta completar: "+((data?.missing||[]).join(", ")||"configuración mínima"));
      sessionStorage.removeItem("mc-publish-intent:"+siteId);
      location.href=OFFICIAL_ORIGIN+"/simple/app?published=1";
    }catch(error){
      toast(error?.message||"No se pudo publicar la tienda.",true);
      button.disabled=false;
      button.textContent="PUBLICAR MI TIENDA";
    }
  }

  async function finishPublishAfterBilling(){
    const siteId=q.get("site")||dash()?.site?.id;
    if(!siteId||q.get("billing_return")!=="1")return;
    if(sessionStorage.getItem("mc-publish-intent:"+siteId)!=="1"&&q.get("publish_after_billing")!=="1")return;
    const key="mc-publish-finish-running:"+siteId;
    if(sessionStorage.getItem(key))return;
    sessionStorage.setItem(key,"1");
    try{
      toast("Verificando activación y publicando…");
      await billingRequest("subscription_refresh",siteId);
      const c=client();
      const {data,error}=await c.rpc("simple_publish_store",{p_site_id:siteId});
      if(error)throw error;
      if(!data?.published)throw new Error("La activación todavía no está confirmada o falta completar la tienda.");
      sessionStorage.removeItem("mc-publish-intent:"+siteId);
      sessionStorage.removeItem(key);
      location.replace(OFFICIAL_ORIGIN+"/simple/app?published=1");
    }catch(error){
      sessionStorage.removeItem(key);
      toast(error?.message||"La activación todavía está pendiente. Volvé a intentar Publicar.",true);
    }
  }

  function capturePublish(){
    document.addEventListener("click",event=>{
      const button=event.target?.closest?.("#mc-publish");
      if(!button)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      publishFixed(button);
    },true);
  }

  function enhance(){
    enhanceCategoryCreator();
  }

  injectStyles();
  capturePublish();
  new MutationObserver(enhance).observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener("DOMContentLoaded",()=>{
    enhance();
    if(PREVIEW&&DEVICE==="mobile")document.body.classList.add("mc-preview-mobile");
    setTimeout(()=>finishPublishAfterBilling().catch(()=>{}),150);
  });
})();
