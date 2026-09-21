(function(){
if(window.__MC_BUSINESS_PROFILES_R178__)return;window.__MC_BUSINESS_PROFILES_R178__=true;
const MAP={
 hamburger:{label:'Hamburguesería / Fast food',icon:'🍔',type:'gastronomy',vertical:'general',preset:'bold-delivery-v1',reservations:false,desc:'Pedidos, menú, extras, ingredientes, delivery y Mercado Pago.'},
 gastronomy:{label:'Gastronomía general',icon:'🍽',type:'gastronomy',vertical:'general',preset:'minimal-clean-v1',reservations:false,desc:'Carta online, pedidos, horarios, delivery y cobros.'},
 hardware:{label:'Ferretería',icon:'🛠',type:'retail',vertical:'hardware',preset:'hardware-pro-v1',reservations:false,desc:'Catálogo grande, rubros, marcas, stock, precios y tienda profesional.'},
 sports_courts:{label:'Canchas / Reservas deportivas',icon:'⚽',type:'services',vertical:'sports_courts',preset:'sports-courts-v1',reservations:true,desc:'Canchas, agenda, horarios disponibles, seña 50% y reservas online.'},
 footwear:{label:'Zapatería / Sneakers',icon:'👟',type:'retail',vertical:'footwear',preset:'sneaker-street-v1',reservations:false,desc:'Modelos, talles, variantes y stock por talle.'},
 retail:{label:'Tienda / Retail general',icon:'▦',type:'retail',vertical:'general',preset:'retail-pro-v1',reservations:false,desc:'Catálogo, stock, variantes y venta online.'}
};
let installed=false;
const q=s=>document.querySelector(s);
function profile(){return q('#mcBusinessProfile')?.value||'hamburger'}
function ensureUI(){
 const modal=q('#newModal .modal-card');if(!modal)return false;
 if(!q('#mcBusinessProfile')){
  const country=q('#newCountry')?.closest('.field');const wrap=document.createElement('div');wrap.className='mc-profile-block';wrap.innerHTML='<div class="field"><label>Tipo de comercio / modelo operativo</label><select id="mcBusinessProfile">'+Object.entries(MAP).map(([k,v])=>'<option value="'+k+'">'+v.icon+' '+v.label+'</option>').join('')+'</select><div id="mcProfileHint" class="mc-profile-hint"></div></div><div id="mcProfileCards" class="mc-profile-cards">'+Object.entries(MAP).map(([k,v])=>'<button type="button" data-mc-profile="'+k+'"><span>'+v.icon+'</span><div><b>'+v.label+'</b><small>'+v.desc+'</small></div></button>').join('')+'</div>';
  country?.insertAdjacentElement('afterend',wrap);
  q('#mcBusinessProfile').onchange=()=>applyProfile(q('#mcBusinessProfile').value);
  document.querySelectorAll('[data-mc-profile]').forEach(b=>b.onclick=()=>{q('#mcBusinessProfile').value=b.dataset.mcProfile;applyProfile(b.dataset.mcProfile)});
 }
 const old=q('#j3NewVertical');if(old)old.closest('.field')?.classList.add('mc-legacy-profile-hidden');
 applyProfile(profile(),false);return true
}
function allowedPresets(p){
 if(p==='hamburger')return ['bold-delivery-v1','gourmet-dark-v1','minimal-clean-v1'];
 if(p==='gastronomy')return ['minimal-clean-v1','gourmet-dark-v1','bold-delivery-v1'];
 if(p==='hardware')return ['hardware-pro-v1'];
 if(p==='sports_courts')return ['sports-courts-v1'];
 if(p==='footwear')return ['sneaker-street-v1'];
 return ['retail-pro-v1','retail-soft-v1'];
}
function applyProfile(p,forcePreset=true){
 const cfg=MAP[p]||MAP.hamburger,hint=q('#mcProfileHint'),res=q('#newReservations'),type=q('#newBusinessType'),template=q('#newTemplate');
 if(hint)hint.innerHTML='<b>'+cfg.label+'</b><span>'+cfg.desc+'</span><em>Se crea la estructura funcional; identidad, colores y contenido del cliente se configuran después.</em>';
 if(res){res.checked=cfg.reservations;res.closest('label').style.display=p==='sports_courts'?'none':'none'}
 if(type)type.value=cfg.type;
 document.querySelectorAll('[data-mc-profile]').forEach(b=>b.classList.toggle('active',b.dataset.mcProfile===p));
 if(template){
  const ok=allowedPresets(p);Array.from(template.options).forEach(o=>{if(!o.value||o.value.startsWith('site:')){o.hidden=true;return}if(o.value.startsWith('preset:'))o.hidden=!ok.includes(o.value.slice(7))});
  const desired='preset:'+cfg.preset;if(forcePreset||!ok.includes(String(template.value||'').replace(/^preset:/,''))){const opt=Array.from(template.options).find(o=>o.value===desired);if(opt)template.value=desired}
  try{window.j3SyncPresetPreview?.()}catch{}
 }
}
async function createProfileSite(){
 const btn=q('#createBtn'),original=btn.textContent;btn.disabled=true;btn.textContent='CREANDO ESTRUCTURA…';
 try{
  const name=q('#newName').value.trim(),slug=P.slugify(q('#newSlug').value||name),country=q('#newCountry').value||'AR',owner_name=q('#newOwnerName').value.trim(),owner_email=q('#newOwnerEmail').value.trim().toLowerCase(),p=profile(),cfg=MAP[p]||MAP.hamburger,design=q('#newTemplate').value||'',preset=design.startsWith('preset:')?design.slice(7):cfg.preset;
  if(!name)throw new Error('Poné el nombre del comercio');if(!owner_name)throw new Error('Poné el nombre del dueño');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner_email))throw new Error('Ingresá un email válido del dueño');
  const s=await P.rpc('platform_create_site_v178',{p_name:name,p_slug:slug,p_country_code:country,p_business_profile:p,p_preset_key:preset});
  btn.textContent='GENERANDO ACCESO…';let invite;
  try{invite=await P.callEdge('platform-admin',{action:'invite',site_id:s.id,email:owner_email,full_name:owner_name})}
  catch(inviteError){console.error('owner invite',inviteError);show('newModal',false);await window.load?.();window.inviteOwner?.(s.id);if(q('#inviteName'))q('#inviteName').value=owner_name;if(q('#inviteEmail'))q('#inviteEmail').value=owner_email;throw new Error('El comercio se creó, pero faltó generar el acceso del dueño. Reintentá desde la ventana de acceso. '+inviteError.message)}
  show('newModal',false);await window.load?.();
  q('#createdSummary').textContent=(invite.delivery==='email'?('Listo. Enviamos a '+owner_email+' el acceso para '+name+'.'):('Listo. '+name+' quedó creado con perfil '+cfg.label+' y el enlace del dueño está listo.'));
  q('#createdAccessLink').value=invite.access_link||'';q('#createdDesignBtn').dataset.site=s.id;q('#createdCloseBtn').dataset.site=s.id;show('createdModal',true);P.toast('Comercio creado con estructura '+cfg.label+' ✓');
  ['#newName','#newSlug','#newOwnerName','#newOwnerEmail'].forEach(id=>{const x=q(id);if(x)x.value=''});q('#newSlug').dataset.touched='';q('#newCountry').value='AR';q('#mcBusinessProfile').value='hamburger';applyProfile('hamburger');
 }catch(e){P.toast(String(e.message||e).startsWith('El comercio se creó')?e.message:'No se pudo crear: '+(e.message||e),6500)}
 finally{btn.disabled=false;btn.textContent=original}
}
function install(){
 if(installed)return;if(!ensureUI())return;installed=true;
 const btn=q('#createBtn');if(btn)btn.onclick=createProfileSite;
 const oldOpen=window.openNew;window.openNew=function(){const v=oldOpen?oldOpen.apply(this,arguments):undefined;setTimeout(()=>{ensureUI();q('#mcBusinessProfile').value='hamburger';applyProfile('hamburger')},30);return v};
 const observer=new MutationObserver(()=>{if(!q('#newModal')?.classList.contains('hidden')){ensureUI();const b=q('#createBtn');if(b&&b.onclick!==createProfileSite)b.onclick=createProfileSite}});observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class'],childList:true});
}
let t=setInterval(()=>{if(window.P&&q('#newModal')&&q('#createBtn')){install();clearInterval(t)}},100);setTimeout(()=>clearInterval(t),10000);
})();