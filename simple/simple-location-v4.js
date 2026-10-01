(()=>{
  "use strict";

  const PROJECT_URL="https://kjoixhzaxopdbmudzfsg.supabase.co";
  const API_KEY="sb_publishable_G9dKTg3ev1183qjfVkqMXg_kp5WDPaq";
  const LOCATION_URL=PROJECT_URL+"/functions/v1/m-commerce-location";
  let rpcHooked=false;
  let fetchHooked=false;
  let ownerMounted=false;
  let orderEnhanceBusy=false;
  let storefrontLocationLoaded=false;

  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
  const client=()=>window.__mcSimpleClient||null;
  const dash=()=>window.__mcSimpleActualDashboard||null;
  const mapsLink=loc=>loc&&Number.isFinite(Number(loc.lat))&&Number.isFinite(Number(loc.lng))?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${loc.lat},${loc.lng}`)}`:"";

  function toast(message,bad=false){
    let el=document.getElementById("mc-location-toast");
    if(!el){el=document.createElement("div");el.id="mc-location-toast";document.body.appendChild(el);}
    el.textContent=message;
    el.classList.toggle("bad",bad);
    el.classList.add("show");
    clearTimeout(el._timer);
    el._timer=setTimeout(()=>el.classList.remove("show"),3200);
  }

  function injectStyles(){
    if(document.getElementById("mc-location-v4-style"))return;
    const style=document.createElement("style");
    style.id="mc-location-v4-style";
    style.textContent=`
      #mc-location-toast{position:fixed;z-index:100600;left:50%;bottom:22px;transform:translate(-50%,120px);max-width:min(92vw,540px);padding:12px 16px;border-radius:12px;background:#0b1220;color:#fff;font-weight:750;box-shadow:0 16px 40px rgba(0,0,0,.24);transition:.2s}#mc-location-toast.show{transform:translate(-50%,0)}#mc-location-toast.bad{background:#991b2b}
      .mc-location-box{margin-top:10px;border:1px solid #dfe4ec;border-radius:16px;background:#f8fafc;padding:13px;display:grid;gap:10px}.mc-location-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.mc-location-head strong{font-size:14px}.mc-location-head p{margin:3px 0 0;color:#667085;font-size:12px;line-height:1.45}.mc-location-actions{display:flex;gap:8px;flex-wrap:wrap}.mc-location-actions .mini{display:inline-flex;align-items:center;gap:6px}.mc-location-search{position:relative}.mc-location-results{display:grid;gap:6px;margin-top:7px}.mc-location-result{width:100%;text-align:left;border:1px solid #dfe4ec;background:#fff;border-radius:11px;padding:10px 11px;line-height:1.35}.mc-location-result strong{display:block;font-size:13px}.mc-location-result small{display:block;color:#667085;margin-top:2px}.mc-location-selected{display:none;border:1px solid #d9def2;background:#fff;border-radius:13px;padding:11px}.mc-location-selected.show{display:block}.mc-location-selected strong{display:block;font-size:13px}.mc-location-selected span{display:block;color:#667085;font-size:12px;margin-top:3px;line-height:1.4}.mc-location-map{display:none;overflow:hidden;border-radius:13px;border:1px solid #e3e7ee;background:#eef2f7}.mc-location-map.show{display:block}.mc-location-map img{display:block;width:100%;height:190px;object-fit:cover;background:#eef2f7}.mc-location-status{font-size:12px;color:#667085;min-height:17px}.mc-extra-delivery{display:grid;grid-template-columns:1fr 1fr;gap:10px}.mc-extra-delivery .field{margin:0}.mc-order-location{margin-top:8px;padding:9px 10px;border-radius:10px;background:#f6f8fb;border:1px solid #e6eaf0;font-size:12px;line-height:1.45}.mc-order-location a,.mc-store-map-link{font-weight:850;color:inherit;text-decoration:underline;text-underline-offset:2px}.mc-store-map-link{display:inline-flex;margin-top:7px}.mc-location-hidden{display:none!important}
      @media(max-width:620px){.mc-location-head{display:block}.mc-location-actions{margin-top:9px}.mc-extra-delivery{grid-template-columns:1fr}.mc-location-map img{height:165px}}
    `;
    document.head.appendChild(style);
  }

  async function api(action,params={}){
    const url=new URL(LOCATION_URL);
    url.searchParams.set("action",action);
    Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=="")url.searchParams.set(k,String(v));});
    const res=await fetch(url,{headers:{apikey:API_KEY}});
    if(!res.ok)throw new Error((await res.json().catch(()=>({})))?.message||"No pudimos consultar el mapa.");
    return res.json();
  }

  function normalize(loc,source="map"){
    if(!loc)return null;
    const lat=Number(loc.lat),lng=Number(loc.lng);
    if(!Number.isFinite(lat)||!Number.isFinite(lng))return null;
    return {lat,lng,formatted:String(loc.formatted||"").trim(),place_id:String(loc.place_id||""),source};
  }

  function staticMapSrc(loc){
    if(!loc)return "";
    const url=new URL(LOCATION_URL);
    url.searchParams.set("action","static");
    url.searchParams.set("lat",String(loc.lat));
    url.searchParams.set("lng",String(loc.lng));
    return url.toString();
  }

  function currentPosition(){
    return new Promise((resolve,reject)=>{
      if(!navigator.geolocation)return reject(new Error("Tu dispositivo no permite obtener la ubicación."));
      navigator.geolocation.getCurrentPosition(
        pos=>resolve({lat:pos.coords.latitude,lng:pos.coords.longitude}),
        err=>reject(new Error(err.code===1?"Necesitás permitir el acceso a tu ubicación.":"No pudimos obtener tu ubicación. Intentá nuevamente.")),
        {enableHighAccuracy:true,timeout:12000,maximumAge:15000}
      );
    });
  }

  function createPicker({input,initial=null,owner=false}){
    const field=input.closest(".field")||input.parentElement;
    if(!field||field.querySelector(".mc-location-box"))return null;
    let state=normalize(initial,initial?.source||"saved");
    let timer=null;
    let suppress=false;

    const box=document.createElement("div");
    box.className="mc-location-box";
    box.innerHTML=`
      <div class="mc-location-head"><div><strong>📍 Ubicación exacta</strong><p>${owner?"Buscá el local o usá la ubicación actual. Esto ayuda con retiro y delivery.":"Elegí la dirección exacta para que el comercio sepa dónde entregar."}</p></div></div>
      <div class="mc-location-actions"><button type="button" class="mini mc-use-current">Usar mi ubicación actual</button>${state?`<a class="mini mc-open-maps" target="_blank" rel="noopener">Ver en mapa</a>`:""}</div>
      <div class="mc-location-results"></div>
      <div class="mc-location-selected"><strong>Ubicación confirmada</strong><span></span></div>
      <div class="mc-location-map"><img alt="Mapa de la ubicación seleccionada"></div>
      <div class="mc-location-status"></div>`;
    field.appendChild(box);

    const results=box.querySelector(".mc-location-results");
    const selected=box.querySelector(".mc-location-selected");
    const selectedText=selected.querySelector("span");
    const map=box.querySelector(".mc-location-map");
    const mapImg=map.querySelector("img");
    const status=box.querySelector(".mc-location-status");
    const current=box.querySelector(".mc-use-current");

    const syncGlobal=()=>{
      if(owner)window.__mcBusinessLocationDraft=state;
      else window.__mcDeliveryLocation=state;
    };
    const renderState=()=>{
      syncGlobal();
      const old=box.querySelector(".mc-open-maps");if(old)old.remove();
      if(!state){selected.classList.remove("show");map.classList.remove("show");return;}
      selected.classList.add("show");
      selectedText.textContent=state.formatted||`${state.lat.toFixed(6)}, ${state.lng.toFixed(6)}`;
      map.classList.add("show");
      mapImg.src=staticMapSrc(state);
      const link=document.createElement("a");link.className="mini mc-open-maps";link.target="_blank";link.rel="noopener";link.href=mapsLink(state);link.textContent="Ver en Google Maps";box.querySelector(".mc-location-actions").appendChild(link);
    };
    const choose=loc=>{
      state=normalize(loc,loc?.source||"search");
      if(!state)return;
      suppress=true;input.value=state.formatted||input.value;suppress=false;
      results.innerHTML="";status.textContent="Ubicación exacta guardada.";renderState();
    };

    input.addEventListener("input",()=>{
      if(suppress)return;
      state=null;syncGlobal();selected.classList.remove("show");map.classList.remove("show");status.textContent="";
      clearTimeout(timer);
      const text=input.value.trim();
      if(text.length<3){results.innerHTML="";return;}
      timer=setTimeout(async()=>{
        try{
          status.textContent="Buscando dirección…";
          const out=await api("search",{q:text});
          const rows=Array.isArray(out.results)?out.results:[];
          results.innerHTML=rows.map((row,i)=>`<button type="button" class="mc-location-result" data-i="${i}"><strong>${esc(row.formatted||"Dirección")}</strong><small>${esc([row.city,row.postcode].filter(Boolean).join(" · "))}</small></button>`).join("")||'<div class="hint">No encontramos coincidencias. Probá escribiendo calle, número y localidad.</div>';
          results.querySelectorAll(".mc-location-result").forEach(btn=>btn.onclick=()=>choose({...rows[Number(btn.dataset.i)],source:"search"}));
          status.textContent=rows.length?"Elegí una dirección de la lista.":"";
        }catch(error){results.innerHTML="";status.textContent=error?.message||"No pudimos buscar la dirección.";}
      },450);
    });

    current.onclick=async()=>{
      current.disabled=true;status.textContent="Obteniendo tu ubicación…";
      try{
        const pos=await currentPosition();
        const out=await api("reverse",pos);
        choose({...out.result,...pos,source:"gps"});
        status.textContent="Ubicación tomada desde tu dispositivo.";
      }catch(error){toast(error?.message||"No pudimos obtener tu ubicación.",true);status.textContent="";}
      finally{current.disabled=false;}
    };

    renderState();
    return {get:()=>state,set:choose,box};
  }

  function ownerInitial(){
    const st=dash()?.settings||{};
    const lat=Number(st.business_latitude),lng=Number(st.business_longitude);
    if(!Number.isFinite(lat)||!Number.isFinite(lng))return null;
    return {lat,lng,formatted:st.business_address_formatted||st.address||"",place_id:st.business_place_id||"",source:"saved"};
  }

  function mountOwnerPicker(){
    const title=document.querySelector("#wizard .wizard-step h2");
    const input=document.getElementById("w_address");
    if(!title||title.textContent.trim()!=="Dirección y localidad"||!input||input.dataset.mcExactLocation)return;
    input.dataset.mcExactLocation="1";
    ownerMounted=true;
    const picker=createPicker({input,initial:ownerInitial(),owner:true});
    if(picker)window.__mcBusinessLocationDraft=picker.get();
  }

  function hookRpc(){
    const c=client();if(!c||rpcHooked)return;
    rpcHooked=true;
    const previous=c.rpc.bind(c);
    c.rpc=async(name,args={},opts)=>{
      if(name==="simple_save_store_profile"&&args?.p_profile&&document.getElementById("w_address")?.dataset.mcExactLocation){
        const loc=window.__mcBusinessLocationDraft||null;
        args={...args,p_profile:{...args.p_profile,
          business_latitude:loc?.lat??null,
          business_longitude:loc?.lng??null,
          business_place_id:loc?.place_id||null,
          business_address_formatted:loc?.formatted||null
        }};
      }
      return previous(name,args,opts);
    };
  }

  function mountCheckoutPicker(){
    const form=document.getElementById("checkout");
    const input=document.getElementById("delivery_address");
    const method=document.getElementById("delivery_method");
    if(!form||!input||!method||form.dataset.mcExactLocation)return;
    form.dataset.mcExactLocation="1";
    window.__mcDeliveryLocation=null;
    const field=input.closest(".field");
    if(field){
      const label=field.querySelector("label");if(label)label.textContent="Dirección de entrega";
      input.placeholder="Ej: Av. Rivadavia 1234, Merlo";
    }
    const picker=createPicker({input,owner:false});
    const extras=document.createElement("div");
    extras.className="mc-extra-delivery";
    extras.innerHTML='<div class="field"><label for="mc_delivery_unit">Piso / depto (opcional)</label><input id="mc_delivery_unit" maxlength="120" placeholder="Ej: 2° B"></div><div class="field"><label for="mc_delivery_instructions">Indicaciones (opcional)</label><input id="mc_delivery_instructions" maxlength="500" placeholder="Ej: portón negro"></div>';
    picker?.box.after(extras);

    const updateVisibility=()=>{
      const delivery=method.value==="delivery";
      input.closest(".field")?.classList.toggle("mc-location-hidden",!delivery);
      picker?.box.classList.toggle("mc-location-hidden",!delivery);
      extras.classList.toggle("mc-location-hidden",!delivery);
    };
    method.addEventListener("change",updateVisibility);updateVisibility();
  }

  function captureCheckoutValidation(){
    document.addEventListener("submit",event=>{
      const form=event.target;
      if(!(form instanceof HTMLFormElement)||form.id!=="checkout")return;
      const method=form.querySelector("#delivery_method");
      if(method?.value!=="delivery")return;
      if(!window.__mcDeliveryLocation){
        event.preventDefault();event.stopImmediatePropagation();
        toast("Elegí una dirección de la lista o usá tu ubicación actual para confirmar el delivery.",true);
        form.querySelector("#delivery_address")?.focus();
      }
    },true);
  }

  function hookFetch(){
    if(fetchHooked)return;fetchHooked=true;
    const previous=window.fetch.bind(window);
    window.fetch=(input,init={})=>{
      try{
        const url=typeof input==="string"?input:input instanceof URL?input.href:input?.url||"";
        if(url.includes("/functions/v1/simple-checkout")&&String(init?.method||"GET").toUpperCase()==="POST"&&typeof init.body==="string"){
          const body=JSON.parse(init.body);
          if(body.delivery_method==="delivery"){
            const loc=window.__mcDeliveryLocation;
            if(loc){
              body.delivery_latitude=loc.lat;body.delivery_longitude=loc.lng;body.delivery_place_id=loc.place_id||null;body.delivery_address_formatted=loc.formatted||body.delivery_address;body.delivery_address_source=loc.source||"map";
              if(loc.formatted)body.delivery_address=loc.formatted;
            }
            body.delivery_unit=document.getElementById("mc_delivery_unit")?.value||"";
            body.delivery_instructions=document.getElementById("mc_delivery_instructions")?.value||"";
          }
          init={...init,body:JSON.stringify(body)};
        }
      }catch(error){console.warn("mc_location_checkout_hook",error);}
      return previous(input,init);
    };
  }

  async function enhanceOrderLocations(){
    const statuses=[...document.querySelectorAll("#panel .order-status[data-id]")];
    if(!statuses.length||orderEnhanceBusy)return;
    const pending=statuses.filter(s=>!s.closest(".row")?.querySelector(".mc-order-location"));
    if(!pending.length)return;
    const c=client();if(!c)return;
    orderEnhanceBusy=true;
    try{
      const ids=pending.map(s=>s.dataset.id).filter(Boolean);
      const {data,error}=await c.from("orders").select("id,delivery_method,delivery_address,delivery_address_formatted,delivery_latitude,delivery_longitude,delivery_unit,delivery_instructions").in("id",ids);
      if(error)throw error;
      const map=new Map((data||[]).map(row=>[row.id,row]));
      pending.forEach(status=>{
        const row=map.get(status.dataset.id),host=status.closest(".row")?.querySelector(".row-main");
        if(!row||!host||row.delivery_method!=="delivery")return;
        const box=document.createElement("div");box.className="mc-order-location";
        const lat=Number(row.delivery_latitude),lng=Number(row.delivery_longitude),has=Number.isFinite(lat)&&Number.isFinite(lng);
        const address=row.delivery_address_formatted||row.delivery_address||"Dirección no informada";
        box.innerHTML=`📍 <strong>${esc(address)}</strong>${row.delivery_unit?` · ${esc(row.delivery_unit)}`:""}${row.delivery_instructions?`<br>${esc(row.delivery_instructions)}`:""}${has?`<br><a target="_blank" rel="noopener" href="${mapsLink({lat,lng})}">Abrir ubicación exacta</a>`:""}`;
        host.appendChild(box);
      });
    }catch(error){console.warn("mc_order_locations",error);}
    finally{orderEnhanceBusy=false;}
  }

  async function storefrontBusinessLocation(){
    if(storefrontLocationLoaded||!location.pathname.startsWith("/tienda/")||!document.querySelector(".store-info"))return;
    storefrontLocationLoaded=true;
    try{
      const slug=decodeURIComponent(location.pathname.split("/").filter(Boolean)[1]||"");
      const c=client();if(!c)return;
      const preview=new URLSearchParams(location.search).get("preview")==="1";
      const {data,error}=await c.rpc(preview?"simple_preview_storefront":"simple_public_storefront",{p_slug:slug});
      if(error||!data)return;
      const st=data.settings||{},lat=Number(st.business_latitude),lng=Number(st.business_longitude);
      if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
      const info=document.querySelector(".store-info>div:last-child");if(!info||info.querySelector(".mc-store-map-link"))return;
      const link=document.createElement("a");link.className="mc-store-map-link";link.target="_blank";link.rel="noopener";link.href=mapsLink({lat,lng});link.textContent="📍 Cómo llegar";info.appendChild(link);
    }catch(error){console.warn("mc_store_location",error);}
  }

  function enhance(){
    hookRpc();
    mountOwnerPicker();
    mountCheckoutPicker();
    enhanceOrderLocations().catch(()=>{});
    storefrontBusinessLocation().catch(()=>{});
  }

  injectStyles();
  hookFetch();
  captureCheckoutValidation();
  new MutationObserver(enhance).observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener("DOMContentLoaded",enhance);
  enhance();
})();
