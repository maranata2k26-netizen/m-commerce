(()=>{"use strict";
const RUBROS=["Gastronomía","Ropa","Zapatillas","Ferretería","Pinturería","Joyería","Emprendimiento","Catálogo general","Otros"];
const RUBRO_HELP={
  "Gastronomía":"Categorías, extras y variantes simples para vender comida sin volver complejo el panel.",
  "Ropa":"Talles, colores y stock por variante para cada producto.",
  "Zapatillas":"Talles y stock real por variante para evitar vender un talle agotado.",
  "Ferretería":"Marca, modelo, medida y stock, además de variantes cuando hagan falta.",
  "Pinturería":"Marca, medida/presentación, colores y stock por variante.",
  "Joyería":"Variantes de medida, color o terminación y stock por variante.",
  "Emprendimiento":"Catálogo flexible con categorías, variantes y stock opcional.",
  "Catálogo general":"Una configuración simple para productos de cualquier rubro.",
  "Otros":"Configuración general de catálogo, pedidos, pagos y entregas."
};
let client=null;
let baseRpc=null;
let installed=false;
let siteId=null;
let editingProductId=null;
let variantContext=null;
let productExtras=null;
let storefrontApplied=false;

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}
function notify(message,error=false){
  let n=document.getElementById("mc-enhancement-toast");
  if(!n){n=document.createElement("div");n.id="mc-enhancement-toast";n.className="mc-enhancement-toast";document.body.appendChild(n)}
  n.textContent=message;n.classList.toggle("error",error);n.classList.add("show");clearTimeout(n._t);n._t=setTimeout(()=>n.classList.remove("show"),2600);
}
async function currentSiteId(){
  if(siteId)return siteId;
  const d=window.__mcSimpleActualDashboard;
  if(d?.site?.id){siteId=d.site.id;return siteId}
  const {data,error}=await baseRpc("simple_ensure_store",{});if(error)throw error;siteId=data?.id;return siteId;
}
function currentDash(){return window.__mcSimpleActualDashboard||null}
function simpleMeta(dash=currentDash()){return dash?.settings?.site_design?.simple||{}}

function injectStyles(){
  if(document.getElementById("mc-simple-enhancement-style"))return;
  const s=document.createElement("style");s.id="mc-simple-enhancement-style";s.textContent=`
  .mc-preset-zone{margin-top:22px;padding-top:20px;border-top:1px solid var(--line)}.mc-preset-zone h3{margin:0 0 6px}.mc-preset-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}.mc-preset-card{position:relative;border:1px solid var(--line);border-radius:16px;padding:14px;background:#fff;cursor:pointer;display:grid;gap:8px}.mc-preset-card:has(input:checked){border-color:var(--brand);box-shadow:0 0 0 3px rgba(109,93,252,.12)}.mc-preset-card input{position:absolute;opacity:0;pointer-events:none}.mc-preset-card strong{font-size:14px}.mc-preset-card p{margin:0;font-size:12px;color:var(--muted);line-height:1.4}.mc-swatches{display:flex;gap:5px}.mc-swatch{width:24px;height:24px;border-radius:7px;border:1px solid rgba(15,23,42,.12)}.mc-rubro-help{margin-top:10px;padding:11px 12px;border-radius:12px;background:#f6f7fb;color:var(--muted);font-size:12px;line-height:1.45}.mc-personalize-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}.mc-personalize-grid .field{margin:0}.mc-color-input{display:grid;grid-template-columns:46px 1fr;gap:9px;align-items:center}.mc-color-input input[type=color]{padding:2px;min-height:46px;width:46px}.mc-preview-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.mc-design-panel .mc-preset-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.mc-danger-mini{border:1px solid #f1c6cc;background:#fff;color:#b42334;border-radius:9px;padding:8px 10px;font-weight:800}.mc-variant-editor{margin:16px 0;border-top:1px solid var(--line);padding-top:16px}.mc-variant-row{display:grid;grid-template-columns:minmax(150px,1fr) 120px 120px auto;gap:8px;align-items:end;margin:8px 0}.mc-variant-row label{display:grid;gap:5px;font-size:11px;font-weight:800;color:var(--muted)}.mc-variant-row input{border:1px solid #ccd3dd;border-radius:10px;padding:10px;min-width:0}.mc-product-tech{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0}.mc-product-tech .field{margin:0}.mc-instagram-link{display:inline-flex;margin-top:8px;color:inherit;font-weight:800;text-decoration:none;opacity:.9}.mc-enhancement-toast{position:fixed;z-index:100000;left:50%;bottom:22px;transform:translate(-50%,120px);background:#0b1220;color:#fff;padding:12px 16px;border-radius:12px;box-shadow:0 16px 40px rgba(0,0,0,.25);transition:.2s;max-width:90vw}.mc-enhancement-toast.show{transform:translate(-50%,0)}.mc-enhancement-toast.error{background:#8f1d2c}
  .store.mc-preset-store{background:var(--mc-store-bg,#fff);color:var(--mc-store-text,#0b1220)}.store.mc-preset-store .catalog{background:var(--mc-store-bg,#fff)}.store.mc-preset-store .products{grid-template-columns:repeat(var(--mc-columns,3),minmax(0,1fr));gap:var(--mc-gap,15px)}.store.mc-preset-store .product{background:var(--mc-card-bg,#fff);border-color:var(--mc-card-border,#e6eaf0);border-radius:var(--mc-card-radius,18px)}.store.mc-preset-store .product img{height:var(--mc-image-height,auto);aspect-ratio:auto;object-fit:cover}.store.mc-preset-store .product p{color:var(--mc-muted,#667085)}.store.mc-preset-store .chip.active,.store.mc-preset-store .add{background:var(--brand);color:#fff;border-color:var(--brand)}.store.mc-layout-horizontal .product{display:grid;grid-template-columns:42% 58%}.store.mc-layout-horizontal .product img{height:100%;min-height:210px}.store.mc-layout-featured .products{--mc-columns:2}.store.mc-layout-compact .products{--mc-gap:11px}.store.mc-layout-compact .product-body{padding:12px}
  @media(max-width:780px){.mc-design-panel .mc-preset-grid,.mc-preset-grid{grid-template-columns:1fr}.mc-product-tech{grid-template-columns:1fr}.mc-variant-row{grid-template-columns:1fr 1fr}.store.mc-preset-store .products{grid-template-columns:repeat(2,minmax(0,1fr))}.store.mc-layout-horizontal .product{display:block}.store.mc-layout-horizontal .product img{height:var(--mc-image-height,230px);width:100%}}
  @media(max-width:430px){.mc-personalize-grid{grid-template-columns:1fr}.mc-variant-row{grid-template-columns:1fr}.store.mc-preset-store .products{grid-template-columns:1fr}}
  `;document.head.appendChild(s);
}

function installRpcHook(){
  if(installed||!client)return;installed=true;baseRpc=client.rpc.bind(client);
  client.rpc=async(name,args={},opts)=>{
    if(name==="simple_upsert_product"&&variantContext&&document.getElementById("product-edit")&&args?.p_site_id===variantContext.siteId){
      const incoming=args?.p_product||{};
      const same=(incoming.id||null)===(variantContext.productId||null);
      if(same){
        args={...args,p_product:{...incoming,variants:variantContext.variants.map((v,i)=>({...v,sort_order:i}))}};
        if(productExtras){args.p_product.brand=productExtras.brand||null;args.p_product.attributes={...(incoming.attributes||{}),model:productExtras.model||null,measure:productExtras.measure||null};}
      }
    }
    return baseRpc(name,args,opts);
  };
}

async function savePersonalization(payload){
  try{const id=await currentSiteId();const dash=currentDash(),meta=simpleMeta(dash);const full={business_category:payload.business_category??dash?.settings?.business_category??meta.business_category??"",instagram:payload.instagram??meta.instagram??"",primary_color:payload.primary_color??dash?.settings?.primary_color??"#6D5DFC",accent_color:payload.accent_color??dash?.settings?.accent_color??"#3F8CFF",vertical_options:payload.vertical_options??meta.vertical_options??{}};const {data,error}=await baseRpc("simple_save_personalization",{p_site_id:id,p_payload:full});if(error)throw error;if(dash?.settings){dash.settings.primary_color=data.primary_color;dash.settings.accent_color=data.accent_color;dash.settings.site_design=dash.settings.site_design||{};dash.settings.site_design.simple={...(dash.settings.site_design.simple||{}),instagram:data.instagram,business_category:full.business_category,vertical_options:full.vertical_options}}return data}catch(e){notify(e?.message||"No se pudo guardar la personalización.",true);throw e}
}

function rubroOptions(value){return `<option value="">Elegí un rubro</option>${RUBROS.map(x=>`<option value="${esc(x)}" ${x===value?"selected":""}>${esc(x)}</option>`).join("")}`}
async function enhanceRubro(){
  const title=document.querySelector("#wizard .wizard-step h2");if(!title||title.textContent.trim()!=="Rubro")return;
  const old=document.getElementById("w_category");if(!old||old.dataset.mcEnhanced)return;
  const value=RUBROS.includes(old.value)?old.value:"";const select=document.createElement("select");select.id="w_category";select.required=true;select.dataset.mcEnhanced="1";select.innerHTML=rubroOptions(value);old.replaceWith(select);
  const field=select.closest(".field");const help=document.createElement("div");help.className="mc-rubro-help";help.textContent=value?RUBRO_HELP[value]:"Elegí el rubro y M Commerce te mostrará opciones y diseños adecuados.";field.appendChild(help);
  const zone=document.createElement("div");zone.className="mc-preset-zone";zone.id="mc-onboarding-presets";zone.innerHTML='<h3>Elegí el diseño de tu tienda</h3><p class="muted">Son presets reales de M Commerce. Al elegir uno se aplica inmediatamente a tu borrador.</p><div class="mc-preset-grid"><div class="muted">Elegí primero el rubro.</div></div>';field.after(zone);
  const load=async()=>{if(!select.value){zone.querySelector(".mc-preset-grid").innerHTML='<div class="muted">Elegí primero el rubro.</div>';return}help.textContent=RUBRO_HELP[select.value]||RUBRO_HELP.Otros;await savePersonalization({business_category:select.value});await renderPresetCards(zone,await currentSiteId(),true)};
  select.addEventListener("change",()=>load().catch(()=>{}));if(value)load().catch(()=>{});
}

async function renderPresetCards(host,id,required=false,onApplied=null){
  const grid=host.querySelector(".mc-preset-grid")||host;grid.innerHTML='<div class="muted">Cargando diseños reales…</div>';
  const {data,error}=await baseRpc("simple_design_presets",{p_site_id:id});if(error)throw error;const presets=Array.isArray(data)?data:[];
  if(!presets.length){grid.innerHTML='<div class="muted">No encontramos un preset compatible. Cambiá el rubro o usá el diseño base.</div>';return}
  grid.innerHTML=presets.map(p=>`<label class="mc-preset-card"><input type="radio" name="mc_design_preset" value="${esc(p.preset_key)}" ${p.selected?"checked":""} ${required?"required":""}><strong>${esc(p.name)}</strong><p>${esc(p.description||"")}</p><div class="mc-swatches">${(p.swatches||p.preview?.swatches||[]).slice(0,5).map(c=>`<span class="mc-swatch" style="background:${esc(c)}"></span>`).join("")}</div></label>`).join("");
  grid.querySelectorAll('input[name="mc_design_preset"]').forEach(r=>r.addEventListener("change",async()=>{if(!r.checked)return;try{grid.style.opacity=".55";grid.style.pointerEvents="none";const out=await baseRpc("simple_apply_design_preset",{p_site_id:id,p_preset_key:r.value});if(out.error)throw out.error;notify(`Diseño ${out.data?.name||"seleccionado"} aplicado.`);if(onApplied)await onApplied(out.data)}catch(e){notify(e?.message||"No se pudo aplicar el diseño.",true)}finally{grid.style.opacity="";grid.style.pointerEvents=""}}));
}

async function enhanceOptionalPersonalization(){
  const title=document.querySelector("#wizard .wizard-step h2");if(!title||title.textContent.trim()!=="Dirección y localidad")return;
  const address=document.getElementById("w_address");if(!address||address.dataset.mcEnhanced)return;address.dataset.mcEnhanced="1";address.required=false;address.placeholder="Opcional";const label=address.closest(".field")?.querySelector("label");if(label)label.textContent="Dirección o localidad (opcional)";
  const dash=currentDash(),meta=simpleMeta(dash);const box=document.createElement("div");box.className="mc-personalize-grid";box.innerHTML=`<div class="field"><label for="mc_instagram">Instagram (opcional)</label><input id="mc_instagram" type="text" value="${esc(meta.instagram||"")}" placeholder="@mitienda"></div><div class="field"><label for="mc_primary">Color principal</label><div class="mc-color-input"><input id="mc_primary" type="color" value="${esc(dash?.settings?.primary_color||"#6D5DFC")}"><input id="mc_primary_text" type="text" value="${esc(dash?.settings?.primary_color||"#6D5DFC")}" maxlength="7"></div></div><div class="field"><label for="mc_accent">Color secundario</label><div class="mc-color-input"><input id="mc_accent" type="color" value="${esc(dash?.settings?.accent_color||"#3F8CFF")}"><input id="mc_accent_text" type="text" value="${esc(dash?.settings?.accent_color||"#3F8CFF")}" maxlength="7"></div></div></div>`;address.closest(".field").after(box);
  const ig=box.querySelector("#mc_instagram"),pc=box.querySelector("#mc_primary"),pt=box.querySelector("#mc_primary_text"),ac=box.querySelector("#mc_accent"),at=box.querySelector("#mc_accent_text");
  pc.oninput=()=>pt.value=pc.value;ac.oninput=()=>at.value=ac.value;pt.oninput=()=>{if(/^#[0-9a-f]{6}$/i.test(pt.value))pc.value=pt.value};at.oninput=()=>{if(/^#[0-9a-f]{6}$/i.test(at.value))ac.value=at.value};
  const save=()=>savePersonalization({instagram:ig.value,primary_color:pt.value,accent_color:at.value}).then(()=>notify("Personalización guardada.")).catch(()=>{});ig.addEventListener("change",save);pt.addEventListener("change",save);at.addEventListener("change",save);
}

function enhanceDashboardMenu(){
  const grid=document.querySelector(".menu-grid"),dash=currentDash();if(!grid||!dash?.site?.simple_onboarding_completed_at)return;
  [...grid.querySelectorAll(".menu-item")].forEach(b=>{if(b.textContent.includes("Entregas")){const div=b.querySelector("div");if(div)div.innerHTML='Envíos<br><small>Retiro y delivery</small>'}});
  if(!document.getElementById("mc-design-button")){
    const b=document.createElement("button");b.className="menu-item";b.id="mc-design-button";b.innerHTML='<span>✦</span><div>Diseño<br><small>Preset, colores y redes</small></div>';const store=[...grid.children].find(x=>x.textContent.includes("Mi tienda"));store?.after(b);b.onclick=()=>openDesignPanel(dash).catch(e=>notify(e.message,true));
  }
  if(!document.getElementById("mc-config-button")){
    const b=document.createElement("button");b.className="menu-item";b.id="mc-config-button";b.innerHTML='<span>⚙</span><div>Configuración<br><small>Datos generales</small></div>';grid.appendChild(b);b.onclick=()=>openConfigPanel(dash);
  }
}

async function openDesignPanel(dash){
  const panel=document.getElementById("panel"),id=dash.site.id,meta=simpleMeta(dash);if(!panel)return;panel.innerHTML='<div class="card mc-design-panel"><div class="section-head"><h2>Diseño</h2><span class="status">Vista real</span></div><p class="muted">Elegí un preset real de M Commerce y ajustá los colores. La vista previa usa el mismo catálogo que verá tu cliente.</p><div id="mc-design-presets" class="mc-preset-grid"></div><div class="mc-personalize-grid"><div class="field"><label>Instagram</label><input id="mc-design-instagram" value="'+esc(meta.instagram||'')+'" placeholder="@mitienda"></div><div class="field"><label>Color principal</label><input id="mc-design-primary" type="color" value="'+esc(dash.settings.primary_color||'#6D5DFC')+'"></div><div class="field"><label>Color secundario</label><input id="mc-design-accent" type="color" value="'+esc(dash.settings.accent_color||'#3F8CFF')+'"></div></div><div class="hero-actions"><button id="mc-save-design" class="btn brand">Guardar personalización</button></div><div class="mc-preview-links"></div></div>';
  const links=panel.querySelector(".mc-preview-links"),base=`/tienda/${encodeURIComponent(dash.site.slug)}`;links.innerHTML=`<a class="btn secondary" target="_blank" rel="noopener" href="${base}?preview=1&device=mobile">Vista previa celular</a><a class="btn secondary" target="_blank" rel="noopener" href="${base}?preview=1&device=desktop">Vista previa PC</a>`;
  await renderPresetCards(panel.querySelector("#mc-design-presets"),id,false,async out=>{dash.settings.primary_color=out.primary_color;dash.settings.accent_color=out.accent_color;panel.querySelector("#mc-design-primary").value=out.primary_color;panel.querySelector("#mc-design-accent").value=out.accent_color});
  panel.querySelector("#mc-save-design").onclick=async ev=>{const b=ev.currentTarget;b.disabled=true;try{await savePersonalization({instagram:panel.querySelector("#mc-design-instagram").value,primary_color:panel.querySelector("#mc-design-primary").value,accent_color:panel.querySelector("#mc-design-accent").value});notify("Diseño guardado.")}finally{b.disabled=false}};
}
function openConfigPanel(dash){const panel=document.getElementById("panel");if(!panel)return;panel.innerHTML=`<div class="card"><h2>Configuración</h2><p class="muted">${esc(dash.settings.business_name||dash.site.name)} · ${esc(dash.settings.business_category||"Rubro sin definir")}</p><div class="hero-actions"><button class="btn brand" id="mc-edit-guided">Editar datos de la tienda</button><button class="btn secondary" id="mc-open-plan">Mi plan</button></div></div>`;panel.querySelector("#mc-edit-guided").onclick=()=>{const old=[...document.querySelectorAll('.menu-item')].find(x=>x.textContent.includes('Mi tienda'));old?.click()};panel.querySelector("#mc-open-plan").onclick=()=>{const old=[...document.querySelectorAll('.menu-item')].find(x=>x.textContent.includes('Mi plan'));old?.click()}}

function wireCatalogButtons(){
  document.querySelectorAll(".edit-product").forEach(b=>{if(b.dataset.mcWire)return;b.dataset.mcWire="1";b.addEventListener("click",()=>{try{editingProductId=JSON.parse(b.dataset.json).id}catch{editingProductId=null}},true);const row=b.closest(".row");if(row&&!row.querySelector(".mc-delete-product")){const del=document.createElement("button");del.type="button";del.className="mc-danger-mini mc-delete-product";del.textContent="Eliminar";del.onclick=async e=>{e.stopPropagation();let p;try{p=JSON.parse(b.dataset.json)}catch{return}if(!confirm(`¿Eliminar ${p.name}?`))return;try{const id=await currentSiteId();const {error}=await baseRpc("simple_delete_product",{p_site_id:id,p_product_id:p.id});if(error)throw error;notify("Producto eliminado.");[...document.querySelectorAll('.menu-item')].find(x=>x.textContent.includes('Productos'))?.click()}catch(err){notify(err.message||"No se pudo eliminar.",true)}};b.after(del)}});
  const np=document.getElementById("new-product");if(np&&!np.dataset.mcWire){np.dataset.mcWire="1";np.addEventListener("click",()=>{editingProductId=null},true)}
  document.querySelectorAll(".edit-category").forEach(b=>{if(b.dataset.mcWire)return;b.dataset.mcWire="1";const row=b.closest(".row");if(row&&!row.querySelector(".mc-delete-category")){const del=document.createElement("button");del.type="button";del.className="mc-danger-mini mc-delete-category";del.textContent="Eliminar";del.onclick=async e=>{e.stopPropagation();let c;try{c=JSON.parse(b.dataset.json)}catch{return}if(!confirm(`¿Eliminar la categoría ${c.name}?`))return;try{const id=await currentSiteId();const {error}=await baseRpc("simple_delete_category",{p_site_id:id,p_category_id:c.id});if(error)throw error;notify("Categoría eliminada.");[...document.querySelectorAll('.menu-item')].find(x=>x.textContent.includes('Categorías'))?.click()}catch(err){notify(err.message?.includes('CATEGORY_NOT_EMPTY')?"La categoría tiene productos. Movelos o eliminalos primero.":err.message||"No se pudo eliminar.",true)}};b.after(del)}})});
}

async function enhanceProductForm(){
  const form=document.getElementById("product-edit"),ta=document.getElementById("p_variants");if(!form||!ta||form.dataset.mcEnhanced)return;form.dataset.mcEnhanced="1";const id=await currentSiteId(),dash=currentDash(),rubro=dash?.settings?.business_category||"Catálogo general";
  let variants=[],extra={brand:"",attributes:{}};
  if(editingProductId){const vr=await client.from("product_variants").select("name,price_delta,stock_tracking,stock_quantity,attributes,sort_order").eq("site_id",id).eq("product_id",editingProductId).order("sort_order");if(!vr.error)variants=vr.data||[];const pr=await client.from("products").select("brand,attributes").eq("site_id",id).eq("id",editingProductId).maybeSingle();if(!pr.error&&pr.data)extra=pr.data}
  ta.closest(".field").style.display="none";
  const holder=document.createElement("section");holder.className="mc-variant-editor";holder.innerHTML=`<div class="section-head"><div><h3>Variantes y stock</h3><p class="muted">${esc(RUBRO_HELP[rubro]||"Podés agregar variantes y stock individual.")}</p></div><button type="button" class="mini" id="mc-add-variant">+ Variante</button></div><div id="mc-variant-rows"></div>`;ta.closest(".field").after(holder);
  const technical=["Ferretería","Pinturería"].includes(rubro);if(technical){const tech=document.createElement("div");tech.className="mc-product-tech";tech.innerHTML=`<div class="field"><label>Marca</label><input id="mc-prod-brand" value="${esc(extra.brand||"")}"></div><div class="field"><label>Modelo</label><input id="mc-prod-model" value="${esc(extra.attributes?.model||"")}"></div><div class="field"><label>Medida / presentación</label><input id="mc-prod-measure" value="${esc(extra.attributes?.measure||"")}"></div>`;holder.before(tech)}
  const rows=holder.querySelector("#mc-variant-rows");
  const add=(v={})=>{const row=document.createElement("div");row.className="mc-variant-row";row.innerHTML=`<label>Variante<input class="mc-v-name" value="${esc(v.name||"")}" placeholder="${esc(rubro==="Zapatillas"?"Talle 40":rubro==="Ropa"?"Talle M · Negro":rubro==="Ferretería"?"Medida 20 mm":"Opción")}"></label><label>Adicional $<input class="mc-v-price" type="number" step="0.01" value="${Number(v.price_delta||0)}"></label><label>Stock<input class="mc-v-stock" type="number" min="0" step="1" value="${v.stock_tracking&&v.stock_quantity!=null?Number(v.stock_quantity):""}" placeholder="Opcional"></label><button type="button" class="mc-danger-mini mc-v-remove">Quitar</button>`;rows.appendChild(row);row.querySelector(".mc-v-remove").onclick=()=>{row.remove();sync()};row.querySelectorAll("input").forEach(x=>x.addEventListener("input",sync));sync()};
  const sync=()=>{const out=[...rows.querySelectorAll(".mc-variant-row")].map((r,i)=>{const stock=r.querySelector(".mc-v-stock").value;return {name:r.querySelector(".mc-v-name").value.trim(),price_delta:Number(r.querySelector(".mc-v-price").value||0),stock_tracking:stock!=="",stock_quantity:stock===""?null:Number(stock),attributes:{},sort_order:i}}).filter(v=>v.name);variantContext={siteId:id,productId:editingProductId||null,variants:out};ta.value=out.map(v=>`${v.name} | ${v.price_delta}`).join("\n");if(technical)productExtras={brand:document.getElementById("mc-prod-brand")?.value||"",model:document.getElementById("mc-prod-model")?.value||"",measure:document.getElementById("mc-prod-measure")?.value||""};else productExtras=null};
  (variants.length?variants:[]).forEach(add);holder.querySelector("#mc-add-variant").onclick=()=>add({});if(technical)form.querySelectorAll("#mc-prod-brand,#mc-prod-model,#mc-prod-measure").forEach(x=>x.addEventListener("input",sync));sync();
}

async function applyStorefrontDesign(){
  if(storefrontApplied||!location.pathname.startsWith("/tienda/")||!document.querySelector(".store"))return;storefrontApplied=true;try{const slug=decodeURIComponent(location.pathname.split('/').filter(Boolean)[1]||"");const preview=new URLSearchParams(location.search).get("preview")==="1";const {data,error}=await baseRpc(preview?"simple_preview_storefront":"simple_public_storefront",{p_slug:slug});if(error||!data)return;const st=data.settings||{},d=data.design||{},menu=d.menu||{},colors=d.builder?.designSystem?.colors||{};const root=document.documentElement,store=document.querySelector(".store");root.style.setProperty("--brand",st.primary_color||colors.primary||"#6D5DFC");root.style.setProperty("--brand2",st.accent_color||colors.secondary||colors.accent||"#3F8CFF");store.classList.add("mc-preset-store",`mc-layout-${menu.layout||"classic"}`);store.style.setProperty("--mc-columns",String(Math.max(1,Math.min(4,Number(menu.desktopColumns||3)))));store.style.setProperty("--mc-gap",`${Math.max(8,Math.min(40,Number(menu.gap||15)))}px`);store.style.setProperty("--mc-card-radius",`${Math.max(0,Math.min(40,Number(menu.cardRadius??18)))}px`);store.style.setProperty("--mc-image-height",`${Math.max(150,Math.min(480,Number(menu.imageHeight||260)))}px`);store.style.setProperty("--mc-store-bg",colors.background||d.theme?.cream||"#fff");store.style.setProperty("--mc-store-text",colors.text||menu.titleColor||"#0b1220");store.style.setProperty("--mc-card-bg",menu.cardBackground||"#fff");store.style.setProperty("--mc-card-border",menu.cardBorderColor||"#e6eaf0");store.style.setProperty("--mc-muted",menu.descriptionColor||"#667085");if(d.header?.background){const head=store.querySelector(".store-head");if(head&&!st.cover_url)head.style.background=d.header.background}const ig=d.simple?.instagram;if(ig&&!store.querySelector(".mc-instagram-link")){const info=store.querySelector(".store-info>div:last-child");if(info){const a=document.createElement("a");a.className="mc-instagram-link";a.href=`https://instagram.com/${encodeURIComponent(ig)}`;a.target="_blank";a.rel="noopener noreferrer";a.textContent=`@${ig}`;info.appendChild(a)}}}catch(e){console.warn("simple_storefront_design",e)}
}

function enhance(){
  enhanceRubro().catch(()=>{});enhanceOptionalPersonalization().catch(()=>{});enhanceDashboardMenu();wireCatalogButtons();enhanceProductForm().catch(()=>{});applyStorefrontDesign().catch(()=>{});
}
function boot(){client=window.__mcSimpleClient;if(!client){setTimeout(boot,40);return}installRpcHook();injectStyles();new MutationObserver(enhance).observe(document.documentElement,{subtree:true,childList:true});enhance()}
boot();
})();