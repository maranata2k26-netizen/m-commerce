'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const {webcrypto,createHmac}=require('node:crypto');
const site='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function harness(options={}) {
 let handler,events=0,lookups=0,reconciliations=0;
 const writes=[];
 const sub={site_id:site,amount_override:25000,plan_id:'plan',provider_subscription_id:'sub-test',last_paid_at:null};
 const account={status:'connected',mp_user_id:'12345',account_email:'collector@example.invalid',expected_email:'collector@example.invalid',confirmed_at:'2026-01-01',access_token:'TEST_ONLY',expires_at:'2099-01-01'};
 const admin={from(table){const q={select(){return q},eq(){return q},neq(){return q},single:async()=>({data:table==='sites'?{product_tier:'simple'}:sub}),
  maybeSingle:async()=>({data:table==='platform_billing_accounts'?account:table==='site_subscriptions'?sub:table==='subscription_plans'?{monthly_price:25000}:table==='subscription_payment_events'?{id:'event'}:null}),
  then(resolve,reject){return Promise.resolve({data:table==='mercadopago_connections'?[]:null,error:null}).then(resolve,reject)},
  async upsert(){if(table==='subscription_payment_events')events++;return{error:null}},
  async insert(){return{error:null}},update(value){writes.push({table,value});return q;}};return q;},
  async rpc(name,args){assert.equal(name,'simple_reconcile_subscription_entitlement');assert.equal(args.p_site_id,site);assert.equal(args.p_subscription_id,'sub-test');reconciliations++;return options.failRPC?{error:new Error('fixture failure')}:{data:{status:'pending'},error:null};}};
 const sandbox={Request,Response,URL,TextEncoder,Uint8Array,Date,crypto:webcrypto,console:{error(){}},createClient:()=>admin,
  Deno:{env:{get:n=>({SUPABASE_URL:'https://stage.example.invalid',SUPABASE_SERVICE_ROLE_KEY:'TEST_ONLY',MERCADOPAGO_WEBHOOK_SECRET:'TEST_SIGNATURE_SECRET'}[n])},serve:fn=>{handler=fn}},
  fetch:async url=>{lookups++;const u=String(url);let data;
   if(u.includes('/authorized_payments/search'))data={results:[{id:'invoice',preapproval_id:'sub-test'}]};
   else if(u.includes('/v1/payments/'))data={id:'910131',status:options.status||'approved',collector_id:options.collector||'12345',transaction_amount:options.amount??25000,currency_id:options.currency??'ARS',date_approved:'2026-10-13T17:00:00Z'};
   else if(u.includes('/preapproval/'))data={id:'sub-test',external_reference:site,status:'authorized',next_payment_date:'2099-01-01'};
   else throw new Error('Unexpected provider request '+u);
   return new Response(JSON.stringify(data),{status:200});}};
 const source=fs.readFileSync('supabase/functions/j3-billing-webhook/index.ts','utf8').replace(/^import .*;\r?\n/gm,'');
 vm.runInNewContext(stripTypeScriptTypes(source),sandbox);
 const run=()=>{const ts=String(Math.floor(Date.now()/1000)),rid='TEST_REQUEST';const hash=createHmac('sha256','TEST_SIGNATURE_SECRET').update(`id:910131;request-id:${rid};ts:${ts};`).digest('hex');
  return handler(new Request('https://stage.example.invalid/hook?type=payment&data.id=910131',{method:'POST',headers:{'content-type':'application/json','x-request-id':rid,'x-signature':`ts=${ts},v1=${options.invalidSignature?'invalid':hash}`},body:'{}'}));};
 return {run,writes,events:()=>events,lookups:()=>lookups,reconciliations:()=>reconciliations};
}
test('subscription webhook rejects an unverified collector, currency and even a one-cent mismatch before recording payments',async()=>{
 for(const options of [{collector:'wrong'},{currency:'USD'},{amount:25000.01}]){const h=harness(options);assert.equal((await h.run()).status,500);assert.equal(h.events(),0);assert.equal(h.reconciliations(),0);}
});
test('invalid signature never reaches the payment provider',async()=>{const h=harness({invalidSignature:true});assert.equal((await h.run()).status,401);assert.equal(h.lookups(),0);});
test('Simple approval, rejection and refund all reconcile server-side without lifting moderation',async()=>{
 for(const status of ['approved','rejected','cancelled','refunded','charged_back']){const h=harness({status});assert.equal((await h.run()).status,200);assert.equal(h.events(),1);assert.ok(h.reconciliations()>0);assert.ok(h.writes.every(w=>w.table!=='sites'||!Object.hasOwn(w.value,'is_suspended')));}
});
test('failed entitlement reconciliation returns a retryable webhook failure',async()=>{const h=harness({status:'refunded',failRPC:true});assert.equal((await h.run()).status,500);assert.equal(h.events(),1);});
