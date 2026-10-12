'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'simple','simple.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase','migrations','20261012185000_simple_master_safe_moderation.sql'),'utf8');
const snippet=source.slice(source.indexOf('async function adminRoute(){'),source.indexOf('function resetPasswordView(){'));

function merchantRecord(overrides={}){
 return {id:'123e4567-e89b-42d3-a456-426614174002',name:'Tienda Azul',slug:'tienda-azul',
 owner_email:'owner@example.com',status:'published',subscription_status:'active',is_suspended:false,
 products:4,orders:2,created_at:'2026-10-12T10:00:00Z',last_activity_at:'2026-10-12T10:00:00Z',
 subscription:{status:'active',billing_mode:'recurring',provider:'mercadopago',
 provider_status:'authorized',monthly_amount:1000,currency_code:'ARS',
 plan_name:'Simple',next_due_at:'2026-11-12T00:00:00Z'},...overrides};
}
function harness(options={}){
 const nodes=new Map(),calls=[],failures=[],notifications=[];
 const app={innerHTML:''};
 let confirmation=options.confirm??true;
 const getNode=id=>{
  if(!nodes.has(id))nodes.set(id,{id,dataset:{},textContent:'',innerHTML:'',disabled:false,onclick:null,oninput:null,onchange:null});
  return nodes.get(id);
 };
 const primary=options.stores||[merchantRecord()];
 const ctx={
  app,document:{getElementById:getNode},
  getSession:async()=>options.session===undefined?{user:{id:'some-id'}}:options.session,
  authView:()=>{app.innerHTML='login';},
  logout:async()=>{},
  rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==='simple_master_stores'){
    if(options.storesError)throw Error(options.storesError);
    return options.refreshStores&&calls.filter(x=>x.name===name).length>1?options.refreshStores:primary;
   }
   if(name==='simple_master_pro_leads'){
    if(options.leadsError)throw Error('NETWORK_FAILURE');
    return options.leads||[];
   }
   if(name==='simple_admin_set_store_state_safe'){
    if(options.actionError)throw Error(options.actionError);
    return {id:args.p_site_id,is_suspended:args.p_action==='suspend'};
   }
   throw Error('Unexpected RPC: '+name);
  },
  esc:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  setBusy:(node,flag)=>{if(node)node.disabled=flag;},
  toast:message=>notifications.push(message),
  fail:e=>failures.push(e.message||String(e)),
  console:{warn:()=>{}},
  window:{confirm:()=>confirmation},
  Date,Number,Intl,
 };
 vm.runInNewContext(snippet,ctx,{timeout:2000});
 return {run:()=>ctx.adminRoute(),app,calls,failures,notifications,getNode,
  setConfirmation:value=>{confirmation=value}};
}
test('the master requires an authenticated session',async()=>{
 const h=harness({session:null});await h.run();
 assert.equal(h.app.innerHTML,'login');
 assert.equal(h.calls.length,0);
});
test('backend denial is not misreported as a network error and network errors allow retry',async()=>{
 const denied=harness({storesError:'ADMIN_REQUIRED'});await denied.run();
 assert.match(denied.app.innerHTML,/Acceso restringido/);
 assert.doesNotMatch(denied.app.innerHTML,/Reintentar/);
 const offline=harness({storesError:'NETWORK_CONNECTION_FAILED'});await offline.run();
 assert.match(offline.app.innerHTML,/Reintentar/);
 assert.doesNotMatch(offline.app.innerHTML,/Acceso restringido/);
 assert.equal(typeof offline.getNode('master-retry').onclick,'function');
});
test('renders admin-only subscription metadata with HTML escaping and no payer secrets',async()=>{
 const h=harness({stores:[merchantRecord({name:'<script>alert(1)</script>'})]});await h.run();
 const list=h.getNode('master-stores').innerHTML;
 assert.match(list,/&lt;script&gt;/);
 assert.doesNotMatch(list,/<script>/);
 assert.match(list,/Suscripción: active/);
 assert.match(list,/Simple/);
 assert.match(list,/mercadopago/);
 assert.match(h.getNode('master-stats').innerHTML,/Suscripciones a revisar/);
 assert.doesNotMatch(list,/provider_subscription_id|provider_payer_email/);
});
test('a declined suspension leaves the store intact with zero mutation RPCs',async()=>{
 const h=harness({confirm:false});await h.run();
 await h.getNode('master-stores').onclick({target:{closest:()=>({dataset:{id:merchantRecord().id}})}});
 assert.equal(h.calls.filter(x=>x.name==='simple_admin_set_store_state_safe').length,0);
 assert.match(h.getNode('master-stores').innerHTML,/Suspender/);
});
test('confirmed suspension passes current backend state, and only trusted response updates the display',async()=>{
 const h=harness();await h.run();
 await h.getNode('master-stores').onclick({target:{closest:()=>({dataset:{id:merchantRecord().id}})}});
 const action=h.calls.find(x=>x.name==='simple_admin_set_store_state_safe');
 assert.equal(action.args.p_action,'suspend');
 assert.equal(action.args.p_expected_suspended,false);
 assert.equal(action.args.p_site_id,merchantRecord().id);
 assert.ok(h.notifications.includes('Estado actualizado y auditado.'));
 assert.match(h.getNode('master-stores').innerHTML,/Reactivar/);
 assert.equal(h.failures.length,0);
});
test('server rejection does not pretend that suspension succeeded, and stale records are refreshed',async()=>{
 const h=harness({actionError:'STORE_STATE_CHANGED_RELOAD',refreshStores:[merchantRecord({is_suspended:true})]});
 await h.run();
 await h.getNode('master-stores').onclick({target:{closest:()=>({dataset:{id:merchantRecord().id}})}});
 assert.equal(h.notifications.filter(v=>v.includes('actualizado')).length,0);
 assert.ok(h.failures.includes('STORE_STATE_CHANGED_RELOAD'));
 assert.match(h.getNode('master-stores').innerHTML,/Reactivar/);
});
test('failed PRO lead fetch does not lock out stores',async()=>{
 const h=harness({leadsError:true});await h.run();
 assert.match(h.getNode('master-stores').innerHTML,/Tienda Azul/);
 assert.match(h.getNode('master-leads-error').textContent,/No se pudieron cargar/);
});
test('filters and searches keep stores visible only when they match',async()=>{
 const h=harness({stores:[merchantRecord(),merchantRecord({id:'123e4567-e89b-42d3-a456-426614174003',name:'Tienda Roja',slug:'tienda-roja',status:'draft',subscription_status:'pending',subscription:null})]});
 await h.run();
 h.getNode('master-filter').onchange({currentTarget:{value:'draft'}});
 assert.doesNotMatch(h.getNode('master-stores').innerHTML,/Tienda Azul/);
 assert.match(h.getNode('master-stores').innerHTML,/Tienda Roja/);
 h.getNode('master-search').oninput({currentTarget:{value:'AZUL'}});
 assert.doesNotMatch(h.getNode('master-stores').innerHTML,/Tienda Roja/);
});
test('DB migration retains legacy moderation and securely enforces master + state concurrency',()=>{
 assert.match(migration,/CREATE OR REPLACE FUNCTION public\.simple_master_stores/);
 assert.match(migration,/CREATE OR REPLACE FUNCTION public\.simple_admin_set_store_state_safe/);
 assert.match(migration,/platform_is_master_admin\(\)/);
 assert.match(migration,/FOR UPDATE/);
 assert.match(migration,/STORE_STATE_CHANGED_RELOAD/);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.simple_admin_set_store_state_safe/);
 assert.doesNotMatch(migration,/CREATE OR REPLACE FUNCTION public\.simple_admin_set_store_state\(/);
 assert.doesNotMatch(migration,/'provider_subscription_id'|'provider_payer_email'|'provider_creation_attempt_id'/);
 assert.match(source,/simple_admin_set_store_state_safe/);
 assert.doesNotMatch(snippet,/rpc\("simple_admin_set_store_state",/);
});
