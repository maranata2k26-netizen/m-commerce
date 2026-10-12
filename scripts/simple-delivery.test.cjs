'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const main=fs.readFileSync(path.join(root,'simple/simple.js'),'utf8');
const loc=fs.readFileSync(path.join(root,'simple/simple-location-v4.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261012193500_simple_delivery_settings.sql'),'utf8');
const script=fs.readFileSync(path.join(root,'supabase/tests/simple-delivery-staging.sql'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/validate-simple.yml'),'utf8');
const adminCode=main.slice(main.indexOf('async function deliveryPanel('),main.indexOf('async function ordersPanel('));
const normalizeCode=loc.slice(loc.indexOf('  function normalize('),loc.indexOf('  function staticMapSrc('));
const normalize=vm.runInNewContext(normalizeCode+';normalize', {});

test('unconfigured and absent coordinates are never interpreted as 0,0',()=>{
  assert.equal(normalize(null),null);
  assert.equal(normalize({lat:null,lng:null}),null);
  assert.equal(normalize({lat:'',lng:''}),null);
  assert.equal(normalize({lat:-91,lng:1}),null);
  assert.equal(normalize({lat:-34.62,lng:-58.82}).lat,-34.62);
  assert.equal(normalize({lat:0,lng:0}).lng,0); // genuine Equator/Greenwich is valid
  assert.match(loc,/st\.business_latitude==null\|\|st\.business_longitude==null/);
  assert.match(loc,/row\.delivery_latitude!=null&&row\.delivery_longitude!=null/);
});
test('stale geocoding answers cannot overwrite newer input and manual checkout remains available',()=>{
  assert.match(loc,/const seq=\+\+requestSeq/);
  assert.match(loc,/if\(seq!==requestSeq\|\|!input\.isConnected\)return/);
  assert.match(loc,/Podés ingresar tu dirección manualmente/);
  assert.match(loc,/manual\.length<5/);
  assert.match(loc,/body\.delivery_address_source=loc\?\(loc\.source==="google"\?"google":"manual_map"\):"manual"/);
  assert.match(loc,/\.eq\("site_id",activeSiteId\)\.in\("id",ids\)/);
});
test('backend binds flat delivery fee and coverage to the merchant without losing other config',()=>{
  assert.match(migration,/platform_is_site_member\(p_site_id\)/);
  assert.match(migration,/product_tier='simple'/);
  assert.match(migration,/delivery_fee=v_fee/);
  assert.match(migration,/fulfillment_config=coalesce\(fulfillment_config,'\{\}'::jsonb\)/);
  assert.match(migration,/DELIVERY_SETTINGS_CHANGED_RELOAD/);
  assert.match(migration,/REVOKE|revoke all/i);
  assert.match(migration,/grant execute on function public\.simple_update_delivery_settings/);
  assert.match(script,/^BEGIN;/m);
  assert.match(script,/^ROLLBACK;/m);
  assert.match(script,/BACKEND_FEE_MISMATCH/);
  assert.match(workflow,/simple-delivery\.test\.cjs/);
});
function harness(opts={}){
 const calls=[],errors=[],success=[];
 const settings={site_id:'site-a',updated_at:'2026-10-12T10:00:00Z',delivery_fee:25.5,delivery_info:'Zona centro',
 fulfillment_config:{pickup_enabled:true,shipping_enabled:true,free_shipping_from:null,shipping_fee:25.5}};
 const elements=new Map([
  ['#simple-pickup',{checked:true}],['#simple-shipping',{checked:true}],
  ['#simple-shipping-fee',{value:'25.50'}],['#simple-coverage',{value:'Zona centro'}],
  ['#simple-delivery-save',{disabled:false}]
 ]);
 const form={onsubmit:null};
 const panel={innerHTML:'',querySelector(sel){return sel==='#simple-delivery-settings'?form:elements.get(sel)}};
 const ctx={
  rpc:async(name,args)=>{
    calls.push({name,args});
    if(name==='simple_dashboard')return {settings,site:{id:'site-a'}};
    if(opts.fail)throw Error(opts.fail);
    return {...args.p_config,site_id:'site-a',updated_at:'2026-10-12T10:00:01Z',
      fulfillment_config:{...settings.fulfillment_config,...args.p_config}};
  },
  esc:value=>String(value??'').replaceAll('<','&lt;'),
  money:value=>String(value),
  toast:(msg,bad)=>success.push({msg,bad}),
  fail:e=>errors.push(e.message||String(e)),
  setBusy:(node,busy)=>{node.disabled=busy},
  Number,Math,RegExp,String,Object
 };
 vm.runInNewContext(adminCode,ctx,{timeout:2000});
 return{init:()=>ctx.deliveryPanel(panel,'site-a',{settings:{...settings}}),form,elements,calls,errors,success,panel};
}
const submit=()=>({preventDefault(){}});
test('authorized merchant delivery edit uses optimistic version and authoritative fee',async()=>{
 const h=harness();await h.init();
 h.elements.get('#simple-shipping-fee').value='199.75';
 h.elements.get('#simple-coverage').value='Merlo, Libertad';
 await h.form.onsubmit(submit());
 const action=h.calls.find(c=>c.name==='simple_update_delivery_settings');
 assert.equal(action.args.p_site_id,'site-a');
 assert.equal(action.args.p_expected_updated_at,'2026-10-12T10:00:00Z');
 assert.equal(action.args.p_config.delivery_fee,199.75);
 assert.equal(action.args.p_config.delivery_info,'Merlo, Libertad');
 assert.equal(h.errors.length,0);
 assert.equal(h.success.at(-1).bad,undefined);
});
test('cannot disable both fulfillment methods or send negative amounts',async()=>{
 const h=harness();await h.init();
 h.elements.get('#simple-pickup').checked=false;
 h.elements.get('#simple-shipping').checked=false;
 await h.form.onsubmit(submit());
 assert.equal(h.calls.filter(c=>c.name==='simple_update_delivery_settings').length,0);
 h.elements.get('#simple-shipping').checked=true;
 h.elements.get('#simple-shipping-fee').value='-3';
 await h.form.onsubmit(submit());
 assert.equal(h.calls.filter(c=>c.name==='simple_update_delivery_settings').length,0);
 assert.equal(h.success.filter(c=>c.bad).length,2);
});
test('a rejected save is never reported as success',async()=>{
 const h=harness({fail:'SITE_ACCESS_DENIED'});await h.init();
 await h.form.onsubmit(submit());
 assert.ok(h.errors.includes('SITE_ACCESS_DENIED'));
 assert.ok(!h.success.some(s=>s.msg.includes('guardadas correctamente')));
});
test('checkout shows delivery fee before payment without altering order idempotency contract',()=>{
 assert.match(main,/mc-shipping-charge/);
 assert.match(main,/Total estimado/);
 assert.match(main,/Number\(st\.delivery_fee\|\|0\)/);
 assert.match(main,/d\.querySelector\("#delivery_method"\)\.addEventListener\("change",updateDeliveryQuote\)/);
 assert.match(main,/checkout_attempt_id=checkoutAttemptId/);
 assert.match(main,/payment_url/);
 assert.match(main,/st\.delivery_info/);
});

test('checkout normalizes geolocation source to database-supported labels before both offline and paid orders',()=>{
 const edge=fs.readFileSync(path.join(root,'supabase/functions/simple-checkout/index.ts'),'utf8');
 assert.match(edge,/delivery_address_source:requestedDelivery==="delivery"\?/);
 assert.match(edge,/body\.delivery_address_source==="google"\?"google"/);
 assert.match(edge,/lat===null\?"manual"/);
 assert.match(edge,/"manual_map"/);
 assert.doesNotMatch(edge,/source\|\|\(lat!==null\?"geoapify"/);
});
