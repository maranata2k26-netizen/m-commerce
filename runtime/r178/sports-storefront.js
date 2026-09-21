(function(){
if(window.__MC_SPORTS_STOREFRONT_R178__)return;window.__MC_SPORTS_STOREFRONT_R178__=true;
const X={ready:false,availability:null,date:'',sport:'all',active:null,slots:[],design:null,loading:false};
const q=(s,r)=>(r||document).querySelector(s),qa=(s,r)=>Array.from((r||document).querySelectorAll(s));
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const money=v=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(v||0));
const dateKey=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Argentina/Buenos_Aires'});
const clone=x=>JSON.parse(JSON.stringify(x||{}));
function isSports(){try{return String(currentSite?.business_vertical||'')==='sports_courts'}catch{return false}}
function designEl(id){for(const s of X.design?.sections||[]){const e=(s.elements||[]).find(x=>x.id===id);if(e)return e}return null}
function txt(id,fallback=''){return designEl(id)?.text||fallback}
function sec(type){return (X.design?.sections||[]).find(x=>x.type===type)||{}}
function theme(){return Object.assign({green:'#0D2E1E',gold:'#B7F34A',cream:'#F4F7EF',red:'#E64B4B'},X.design?.theme||{})}
function sportLabel(x){return ({football:'FÚTBOL',padel:'PÁDEL',tennis:'TENIS',basketball:'BÁSQUET',volleyball:'VÓLEY',other:'OTRO'})[x]||String(x||'').toUpperCase()}
function sportIcon(x){return ({football:'⚽',padel:'◉',tennis:'🎾',basketball:'🏀',volleyball:'🏐',other:'◆'})[x]||'◆'}
function timeLabel(iso){return new Date(iso).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Argentina/Buenos_Aires'})}
function ensureRoot(){let root=q('#mcSportsRoot');if(!root){root=document.createElement('div');root.id='mcSportsRoot';document.body.appendChild(root)}return root}
function messageBanner(){
 const p=new URLSearchParams(location.search),s=p.get('reservation_payment');if(!s)return '';
 const map={success:['Seña recibida','Tu reserva quedó registrada. Si Mercado Pago ya confirmó el pago, el turno queda confirmado.','ok'],pending:['Pago pendiente','El turno queda retenido mientras Mercado Pago procesa la seña.','wait'],failure:['No se completó el pago','El turno volverá a quedar disponible cuando venza la retención.','bad']},x=map[s];if(!x)return '';
 return '<div class="mcs-pay-result '+x[2]+'"><b>'+x[0]+'</b><span>'+x[1]+'</span></div>'
}
function heroMarkup(){
 const t=theme(),h=sec('hero'),title=txt('sports-title',currentSite?.name||'Reservas deportivas'),copy=txt('sports-copy','Elegí cancha y horario. Reservá online con seña del 50%.'),k=txt('sports-kicker','FÚTBOL · PÁDEL · TURNOS ONLINE'),cta=txt('sports-cta','VER HORARIOS');
 return h.visible===false?'':`<section class="mcs-hero" style="--mcs-primary:${esc(t.green)};--mcs-accent:${esc(t.gold)};background:${esc(h.bg||t.green)}">
  <div class="mcs-nav"><a class="mcs-logo" href="#"><span>M</span><div><b>${esc(currentSite?.name||'COMPLEJO')}</b><small>RESERVAS ONLINE</small></div></a><nav><a href="#mcsCourts">CANCHAS</a><a href="#mcsHow">CÓMO FUNCIONA</a><a class="cta" href="#mcsCourts">RESERVAR</a></nav></div>
  <div class="mcs-hero-grid"><div><div class="mcs-kicker">${esc(k)}</div><h1>${esc(title).replace(/\n/g,'<br>')}</h1><p>${esc(copy)}</p><div class="mcs-hero-actions"><a href="#mcsCourts" class="mcs-main-btn">${esc(cta)}</a><span>SEÑA OBLIGATORIA <b>50%</b></span></div></div><div class="mcs-hero-visual"><div class="mcs-field"><i></i><i></i><i></i><span>TURNOS EN VIVO</span></div></div></div>
 </section>`
}
function courtCard(c){
 const slots=Array.isArray(c.slots)?c.slots:[],img=c.image_url,editor=new URLSearchParams(location.search).get('mcsportseditor')==='1';
 return `<article class="mcs-court-card" data-court-id="${c.id}">
  <div class="mcs-court-photo">${img?`<img src="${esc(img)}" alt="${esc(c.name)}">`:`<div class="mcs-court-fallback"><span>${sportIcon(c.sport_type)}</span><small>${sportLabel(c.sport_type)}</small></div>`}<div class="mcs-court-badges"><span>${sportLabel(c.sport_type)}</span><span>${esc(c.format_label||'CANCHA')}</span></div></div>
  <div class="mcs-court-body"><div class="mcs-court-head"><div><h3>${esc(c.name)}</h3><p>${esc(c.description||'Reservá tu turno online.')}</p></div><div class="mcs-court-price"><b>${money(c.price)}</b><small>por turno</small></div></div>
  <div class="mcs-court-meta"><span>◷ ${Number(c.duration_minutes||60)} min</span><span>◉ Seña ${money(Number(c.price||0)*.5)}</span></div>
  <div class="mcs-slots"><div class="mcs-slots-title"><b>HORARIOS DISPONIBLES</b><span>${slots.length} libres</span></div><div class="mcs-slot-grid">${slots.length?slots.slice(0,8).map(s=>`<button data-slot="${esc(s.start_at)}" data-court="${c.id}" ${editor?'title="Tocá para editar esta cancha"':''}>${timeLabel(s.start_at)}</button>`).join(''):'<div class="mcs-no-slots">Sin turnos libres para esta fecha.</div>'}</div></div>
  </div></article>`
}
function render(){
 if(!isSports())return;const root=ensureRoot(),t=theme(),booking=sec('sports-booking'),footer=sec('footer'),courts=(X.availability?.courts||[]).filter(c=>X.sport==='all'||c.sport_type===X.sport);
 document.body.classList.add('mcSportsStorefront');
 root.style.setProperty('--mcs-primary',t.green);root.style.setProperty('--mcs-accent',t.gold);root.style.setProperty('--mcs-bg',t.cream);
 root.innerHTML=messageBanner()+heroMarkup()+(booking.visible===false?'':`<main id="mcsCourts" class="mcs-booking" style="background:${esc(booking.bg||t.cream)}">
  <div class="mcs-booking-head"><div><div class="mcs-kicker dark">${esc(txt('sports-section-kicker','RESERVAS'))}</div><h2>${esc(txt('sports-section-title','Canchas y horarios disponibles'))}</h2><p>${esc(txt('sports-section-copy','Elegí una fecha y reservá entre los turnos disponibles.'))}</p></div><div class="mcs-trust"><b>50%</b><span>SEÑA ONLINE<br>PARA CONFIRMAR</span></div></div>
  <div class="mcs-toolbar"><label><span>FECHA</span><input id="mcsDate" type="date" value="${esc(X.date)}" min="${dateKey()}"></label><div class="mcs-sport-tabs"><button data-sport="all" class="${X.sport==='all'?'active':''}">TODAS</button><button data-sport="football" class="${X.sport==='football'?'active':''}">⚽ FÚTBOL</button><button data-sport="padel" class="${X.sport==='padel'?'active':''}">◉ PÁDEL</button></div><button id="mcsRefresh" class="mcs-refresh">↻ ACTUALIZAR</button></div>
  <div id="mcsCourtGrid" class="mcs-court-grid">${X.loading?'<div class="mcs-loading">Buscando turnos disponibles…</div>':courts.length?courts.map(courtCard).join(''):'<div class="mcs-loading">No hay canchas disponibles para este filtro.</div>'}</div>
 </main>`)+`<section id="mcsHow" class="mcs-how"><div><span>01</span><b>Elegí cancha</b><p>Compará tipo, duración y precio.</p></div><div><span>02</span><b>Elegí horario</b><p>Sólo mostramos turnos realmente libres.</p></div><div><span>03</span><b>Pagá la seña</b><p>El 50% confirma tu reserva.</p></div></section>`+(footer.visible===false?'':`<footer class="mcs-footer" style="background:${esc(footer.bg||t.green)}"><div><b>${esc(txt('sports-footer-title',currentSite?.name||'COMPLEJO DEPORTIVO'))}</b><span>${esc(txt('sports-footer-copy','Reservas online · M COMMERCE'))}</span></div><div>FÚTBOL · PÁDEL · TURNOS ONLINE</div></footer>`)+bookingModal();
 wire()
}
function bookingModal(){
 const c=X.active;if(!c)return '<div id="mcsBookingModal" class="mcs-modal"></div>';
 return `<div id="mcsBookingModal" class="mcs-modal ${X.active?'open':''}"><div class="mcs-modal-card"><button class="mcs-close" id="mcsClose">×</button><span class="mcs-modal-kicker">${sportLabel(c.sport_type)} · ${esc(c.format_label||'')}</span><h2>${esc(c.name)}</h2><div class="mcs-chosen"><div><small>DÍA</small><b>${new Date(X.slots[0]).toLocaleDateString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'})}</b></div><div><small>HORA</small><b>${timeLabel(X.slots[0])}</b></div><div><small>SEÑA 50%</small><b>${money(Number(c.price||0)*.5)}</b></div></div><div class="mcs-form-grid"><label><span>NOMBRE Y APELLIDO</span><input id="mcsName" autocomplete="name"></label><label><span>TELÉFONO</span><input id="mcsPhone" inputmode="tel" autocomplete="tel"></label><label><span>EMAIL · OPCIONAL</span><input id="mcsEmail" type="email" autocomplete="email"></label><label><span>PERSONAS / JUGADORES</span><input id="mcsParty" type="number" min="1" max="30" value="${Math.min(Number(c.capacity||10),10)}"></label></div><label class="mcs-notes"><span>NOTAS · OPCIONAL</span><textarea id="mcsNotes" placeholder="Aclaraciones para el complejo…"></textarea></label><div class="mcs-payment-box"><div><b>Total del turno</b><strong>${money(c.price)}</strong></div><div><b>Pagás ahora</b><strong>${money(Number(c.price||0)*.5)}</strong></div><p>El turno queda retenido mientras completás el pago. Si la seña no se acredita, vuelve a liberarse automáticamente.</p></div><button id="mcsBook" class="mcs-book-btn">RESERVAR Y PAGAR SEÑA</button><div id="mcsBookError" class="mcs-book-error"></div></div></div>`
}
function wire(){
 const date=q('#mcsDate');if(date)date.onchange=()=>{X.date=date.value;loadAvailability()};
 q('#mcsRefresh')?.addEventListener('click',loadAvailability);qa('[data-sport]').forEach(b=>b.onclick=()=>{X.sport=b.dataset.sport;render()});
 const editor=new URLSearchParams(location.search).get('mcsportseditor')==='1';
 qa('[data-court-id]').forEach(card=>card.onclick=e=>{if(!editor)return;if(e.target.closest('[data-slot]'))return;parent.postMessage({type:'mc-sports-court-select',id:card.dataset.courtId},location.origin)});
 qa('[data-slot]').forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.dataset.court;if(editor){parent.postMessage({type:'mc-sports-court-select',id},location.origin);return}const c=(X.availability?.courts||[]).find(x=>String(x.id)===String(id));if(!c)return;X.active=c;X.slots=[b.dataset.slot];render()});
 q('#mcsClose')?.addEventListener('click',()=>{X.active=null;X.slots=[];render()});q('#mcsBookingModal')?.addEventListener('click',e=>{if(e.target.id==='mcsBookingModal'){X.active=null;X.slots=[];render()}});
 q('#mcsBook')?.addEventListener('click',submitBooking)
}
async function submitBooking(){
 const btn=q('#mcsBook'),err=q('#mcsBookError');if(!X.active||!X.slots[0])return;btn.disabled=true;btn.textContent='GENERANDO RESERVA…';err.textContent='';
 try{
  const payload={site_slug:SITE_SLUG,customer_name:q('#mcsName').value.trim(),customer_phone:q('#mcsPhone').value.trim(),customer_email:q('#mcsEmail').value.trim(),party_size:Number(q('#mcsParty').value||1),reservation_at:X.slots[0],notes:q('#mcsNotes').value.trim(),table_id:X.active.id};
  const r=await fetch(C.SUPABASE_URL+'/functions/v1/reservation-create',{method:'POST',headers:{'content-type':'application/json','apikey':C.SUPABASE_ANON_KEY},body:JSON.stringify(payload)}),j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.message||j.error||'No se pudo crear la reserva');
  if(j.payment_url){location.href=j.payment_url;return}
  X.active=null;X.slots=[];await loadAvailability();alert('Reserva registrada.');
 }catch(e){err.textContent=e.message||String(e);btn.disabled=false;btn.textContent='RESERVAR Y PAGAR SEÑA'}
}
async function loadAvailability(){
 if(!isSports()||X.loading)return;X.loading=true;render();
 try{const r=await sb.rpc('platform_sports_availability',{p_slug:SITE_SLUG,p_date:X.date});if(r.error)throw r.error;X.availability=r.data||{courts:[]}}
 catch(e){console.error(e);X.availability={courts:[]};const root=ensureRoot();root.dataset.error=e.message||String(e)}
 finally{X.loading=false;render()}
}
function boot(){
 if(X.ready||!isSports())return false;X.ready=true;X.date=dateKey();X.design=clone(typeof D!=='undefined'&&D||{});document.body.classList.add('mcSportsStorefront');loadAvailability();return true
}
addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.type!=='mc-sports-design-preview'||!isSports())return;X.design=clone(e.data.design||{});render()});
let timer=setInterval(()=>{if(boot())clearInterval(timer)},80);setTimeout(()=>{boot();if(timer)clearInterval(timer)},6000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&X.ready)loadAvailability()});
})();