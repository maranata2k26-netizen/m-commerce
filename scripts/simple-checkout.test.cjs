'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const frontend=fs.readFileSync(path.join(root,'simple','simple.js'),'utf8');
const server=fs.readFileSync(path.join(root,'supabase','functions','simple-checkout','index.ts'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase','migrations','20261011174500_simple_checkout_replay_consistency.sql'),'utf8');
const start=frontend.indexOf('async function storefront(slug){');
const end=frontend.indexOf('async function logout(){',start);
assert.ok(start>0&&end>start,'storefront implementation must be available');
const snippet=frontend.slice(start,end);
const pid='123e4567-e89b-42d3-a456-426614174000';
const vidA='123e4567-e89b-42d3-a456-426614174001';
const vidB='123e4567-e89b-42d3-a456-426614174002';
function harness(options={}){
 const data={site:{id:'123e4567-e89b-42d3-a456-426614174003',slug:'sample-store',name:'Commerce QA',currency_code:'ARS'},
  settings:{payment_methods:{cash:true,transfer:true,mercadopago:false},delivery_fee:options.deliveryFee??0,fulfillment_config:{pickup_enabled:true,shipping_enabled:true}},
  products:[{id:pid,name:'Remera',price:1000,active:true}],
  variants:[{id:vidA,product_id:pid,name:'Negro',price_delta:0,available:true},
           {id:vidB,product_id:pid,name:'Blanco',price_delta:100,available:true}],
  categories:[]};
 const errors=[],requests=[],notices=[],elements=new Map(),drawers=[];
 let selectedVariant=vidA,failCalls=Number(options.failCalls||0),ids=0;
 const addButton={dataset:{id:pid},closest:()=>({querySelector:()=>({value:selectedVariant})})};
 const cartBar={onclick:null};
 const app={innerHTML:''};
 const forms={checkout:{onsubmit:null}};
 const inputs={customer_name:'Marina Test',customer_phone:'1162760623',delivery_method:'pickup',delivery_address:'',payment_method:'cash'};
 function getElementById(id){
  if(id==='cart-bar')return app.innerHTML.includes('id="cart-bar"')?cartBar:null;
  if(!elements.has(id))elements.set(id,{id,value:inputs[id]??'',dataset:{},disabled:false,onclick:null,addEventListener(type,handler){this['on'+type]=handler;}});
  return elements.get(id);
 }
 function newDrawer(){
  const close={onclick:null};
  const d={className:'',innerHTML:'',removed:false,
   remove(){this.removed=true;},
   querySelector(q){if(q==='.close')return close;if(q==='#checkout')return forms.checkout;if(q.startsWith('#'))return getElementById(q.slice(1));return null;},
   querySelectorAll(q){
    if(q!=='.q')return [];
    d.controls=[...d.innerHTML.matchAll(/<button class="mini q" data-key="([^"]+)" data-d="([^"]+)"/g)]
     .map(m=>({dataset:{key:m[1],d:m[2]},onclick:null}));
    return d.controls;
   }};
  drawers.push(d);return d;
 }
 const context={
  app,window:{M_COMMERCE_OFFICIAL_ORIGIN:'https://m-commerce-staging.vercel.app'},
  document:{body:{appendChild(){}},createElement:newDrawer,querySelectorAll:selector=>selector==='.add'?[addButton]:[],getElementById},
  rpc:async()=>data,esc:s=>String(s??''),money:n=>'$'+String(n),setSeo(){},
  field:(id)=>'<input id="'+id+'">',
  getSession:async()=>null,SUPABASE_URL:'https://staging.supabase.co',SUPABASE_KEY:'anon-test',
  crypto:{randomUUID:()=>{ids++;return '123e4567-e89b-42d3-a456-'+String(ids).padStart(12,'0');}},
  fetch:async(url,init)=>{const body=JSON.parse(init.body);requests.push(body);if(failCalls-->0)throw Error('Simulated temporary connection failure');return {ok:true,json:async()=>options.response??({order:{id:'ok',order_number:42,total:1000},kind:'whatsapp',whatsapp_url:null})}},
  setBusy:(button,on)=>{if(button)button.disabled=on;},fail:e=>errors.push(String(e.message||e)),toast:x=>notices.push(x),
  setTimeout:()=>{},location:{href:'',search:options.returnQuery||''},URLSearchParams,console:{warn(){}}
 };
 vm.runInNewContext(snippet,context,{timeout:2000});
 return{
  init:async()=>{await context.storefront('sample-store');},
  add(v){selectedVariant=v;addButton.onclick();},
  openCart(){cartBar.onclick();return drawers.at(-1);},
  qControls(drawer){return drawer.querySelectorAll('.q').map(b=>{ /* callbacks are installed on earlier instances */ return b; });},
  getQuantityControls(){return drawers.at(-1)?.controls||[];},
  setInput(id,v){getElementById(id).value=v;},
  requests,errors,app,drawers,forms,notices,context
 };
}
function submit(){return {preventDefault(){},submitter:{disabled:false,textContent:'Confirmar',dataset:{}}};}

test('variant quantities are keyed by product+variant (not by product alone)',()=>{
 assert.match(snippet,/data-key="\$\{esc\(x\.key\)\}"/);
 assert.match(snippet,/cart\.find\(i=>i\.key===b\.dataset\.key\)/);
 assert.doesNotMatch(snippet,/cart\.find\(i=>i\.id===b\.dataset\.id\)/);
});

test('quantity + on the second variant never changes the first variant',async()=>{
 const h=harness();await h.init();h.add(vidA);h.add(vidB);
 const drawer=h.openCart();
 const secondPlus=drawer.controls.find(x=>x.dataset.key===pid+':'+vidB&&x.dataset.d==='1');
 assert.ok(secondPlus,'expected quantity control for second variant');
 secondPlus.onclick();
 await h.forms.checkout.onsubmit(submit());
 const order=h.requests.at(-1);
 assert.deepEqual(order.items.map(x=>({variant_id:x.variant_id,quantity:x.quantity})),[
   {variant_id:vidA,quantity:1},
   {variant_id:vidB,quantity:2}
 ]);
});

test('different variants remain separate checkout items and preserve server-side price authority',async()=>{
 const h=harness();await h.init();h.add(vidA);h.add(vidB);
 h.openCart();await h.forms.checkout.onsubmit(submit());
 assert.equal(h.errors.length,0);
 assert.equal(h.requests.length,1);
 const lines=h.requests[0].items;
 assert.equal(lines.length,2);
 assert.equal(lines[0].variant_id,vidA);
 assert.equal(lines[1].variant_id,vidB);
 assert.equal(lines[0].quantity,1);
 assert.equal(lines[1].quantity,1);
 assert.equal(Object.hasOwn(lines[0],'unit_price'),false);
 assert.equal(Object.hasOwn(h.requests[0],'total'),false);
});

test('a failed network response followed by retry reuses exactly the same checkout attempt',async()=>{
 const h=harness({failCalls:1});await h.init();h.add(vidA);h.openCart();
 await h.forms.checkout.onsubmit(submit());
 await h.forms.checkout.onsubmit(submit());
 assert.equal(h.requests.length,2);
 assert.equal(h.requests[0].checkout_attempt_id,h.requests[1].checkout_attempt_id);
 assert.equal(h.requests[0].items[0].quantity,1);
 assert.match(h.errors[0],/Simulated temporary/);
 assert.ok(h.notices.includes('Pedido registrado.'));
});

test('changing order recipient after a failed request must generate a new attempt id',async()=>{
 const h=harness({failCalls:1});await h.init();h.add(vidA);h.openCart();
 await h.forms.checkout.onsubmit(submit());
 h.setInput('customer_name','Otro cliente');
 await h.forms.checkout.onsubmit(submit());
 assert.notEqual(h.requests[0].checkout_attempt_id,h.requests[1].checkout_attempt_id);
});

test('invalid delivery address is rejected locally before creating an order',async()=>{
 const h=harness();await h.init();h.add(vidA);h.openCart();h.setInput('delivery_method','delivery');
 await h.forms.checkout.onsubmit(submit());
 assert.equal(h.requests.length,0);
 assert.match(h.errors[0],/dirección de entrega/i);
});

test('backend refuses disabled delivery mode, malformed quantities and replays side effects only once',()=>{
 assert.match(server,/fulfillment_config/);
 assert.match(server,/DELIVERY_METHOD_DISABLED/);
 assert.match(server,/requestedDelivery==="delivery"&&fulfillment\.shipping_enabled!==true/);
 assert.match(server,/!Number\.isInteger\(x\.quantity\)/);
 assert.match(server,/if\(delivery==="delivery"&&!order\.idempotent_replay\)/);
 assert.match(server,/if\(!order\.idempotent_replay\)try/);
});

test('webshop WhatsApp links normalize local Argentine mobile numbers',()=>{
 const s=server.indexOf('function merchantWhatsAppNumber('),e=server.indexOf('function waMessage(',s);
 assert.ok(s>=0&&e>s);
 const scope={};
 vm.runInNewContext(server.slice(s,e).replace('value:unknown','value'),scope,{timeout:1000});
 assert.equal(scope.merchantWhatsAppNumber('11 6276-0623'),'5491162760623');
 assert.equal(scope.merchantWhatsAppNumber('+54 9 11 6276-0623'),'5491162760623');
 assert.equal(scope.merchantWhatsAppNumber('+54 11 6276-0623'),'5491162760623');
});

test('Mercado Pago returns display neutral verification, never false approval',async()=>{
 const h=harness({returnQuery:'?payment=success&order=fake'});
 await h.init();
 assert.match(h.app.innerHTML,/Tu pago se está verificando/);
 assert.doesNotMatch(h.app.innerHTML,/Pago aprobado/);
 const pending=harness({returnQuery:'?payment=pending'});await pending.init();
 assert.match(pending.app.innerHTML,/pendiente de confirmación/);
 const untrusted=harness({returnQuery:'?payment=forged'});await untrusted.init();
 assert.doesNotMatch(untrusted.app.innerHTML,/Estado del pago/);
});

test('offline checkout database refuses to change payment method when replayed',()=>{
 assert.match(migration,/CHECKOUT_ATTEMPT_CONFLICT/);
 assert.match(migration,/coalesce\(\(v_result->>'idempotent_replay'\)::boolean,false\)/);
 assert.match(migration,/o\.payment_method is distinct from p_payment_method/);
 assert.match(migration,/public\.create_checkout_order_v117/);
});


test('changing map pin or delivery instructions changes checkout attempt before request submission',async()=>{
 const h=harness({failCalls:3});await h.init();h.add(vidA);h.openCart();
 h.setInput('delivery_method','delivery');
 h.setInput('delivery_address','Av Siempre Viva 1234, Merlo');
 h.context.window.__mcDeliveryLocation={lat:-34.665,lng:-58.726,formatted:'Av Siempre Viva 1234, Merlo',source:'search',place_id:'place-1'};
 await h.forms.checkout.onsubmit(submit());
 assert.equal(h.requests.length,1);
 assert.equal(h.requests[0].delivery_address_source,'manual_map');
 assert.equal(h.requests[0].delivery_latitude,-34.665);
 h.context.window.__mcDeliveryLocation={lat:-34.666,lng:-58.727,formatted:'Av Siempre Viva 1234, Merlo',source:'search',place_id:'place-2'};
 await h.forms.checkout.onsubmit(submit());
 assert.equal(h.requests.length,2);
 assert.notEqual(h.requests[0].checkout_attempt_id,h.requests[1].checkout_attempt_id);
 h.setInput('mc_delivery_instructions','Portón rojo');
 await h.forms.checkout.onsubmit(submit());
 assert.equal(h.requests.length,3);
 assert.notEqual(h.requests[1].checkout_attempt_id,h.requests[2].checkout_attempt_id);
 assert.equal(h.requests[2].delivery_instructions,'Portón rojo');
});

test('manual delivery has no invented coordinates and remains within the server contract',async()=>{
 const h=harness({failCalls:1});await h.init();h.add(vidA);h.openCart();
 h.setInput('delivery_method','delivery');
 h.setInput('delivery_address','Calle 1234, Merlo');
 await h.forms.checkout.onsubmit(submit());
 const p=h.requests[0];
 assert.equal(p.delivery_address_source,'manual');
 assert.equal(Object.hasOwn(p,'delivery_latitude'),false);
 assert.equal(Object.hasOwn(p,'delivery_longitude'),false);
});


test('checkout quote shows the merchant delivery fee, and pickup remains fee-free',async()=>{
 const h=harness({deliveryFee:120.5});await h.init();h.add(vidA);h.openCart();
 const delivery=h.context.document.getElementById('delivery_method');
 const total=h.context.document.getElementById('mc-grand-total');
 const charge=h.context.document.getElementById('mc-shipping-charge');
 assert.equal(total.textContent,'Total estimado: $1000');
 delivery.value='delivery';delivery.onchange();
 assert.equal(total.textContent,'Total estimado: $1120.5');
 assert.equal(charge.textContent,'Envío: $120.5');
 delivery.value='pickup';delivery.onchange();
 assert.equal(total.textContent,'Total estimado: $1000');
});

test('confirmed offline checkout keeps a visible order reference and never clears an unconfirmed response',async()=>{
 const confirmed=harness();await confirmed.init();confirmed.add(vidA);confirmed.openCart();await confirmed.forms.checkout.onsubmit({preventDefault(){},submitter:{}});assert.match(confirmed.app.innerHTML,/Número de pedido:[\s\S]*42/);assert.match(confirmed.app.innerHTML,/Total confirmado/);
 const incomplete=harness({response:{}});await incomplete.init();incomplete.add(vidA);incomplete.openCart();await incomplete.forms.checkout.onsubmit({preventDefault(){},submitter:{}});assert.equal(incomplete.notices.length,0);assert.match(incomplete.errors.join(' '),/No recibimos la confirmación/);assert.match(incomplete.app.innerHTML,/Ver pedido/);
});
