const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync('supabase/functions/j3-billing/index.ts','utf8');
const helpers=source.slice(source.indexOf('function subscriptionPayerEmail('),source.indexOf('async function authUser('));
function context(){const ctx={};vm.runInNewContext(stripTypeScriptTypes(helpers),ctx);return ctx;}
test('merchant can pay using a Mercado Pago email different from the login email',()=>{
 const ctx=context();assert.equal(ctx.subscriptionPayerEmail({payer_email:' Buyer@Example.com '},'login@example.invalid','',false),'buyer@example.com');
 assert.equal(ctx.subscriptionPayerEmail({},'login@example.com','',false),'login@example.com');
 assert.throws(()=>ctx.subscriptionPayerEmail({payer_email:'invalid'},'login@example.com','',false),/PAYER_EMAIL_REQUIRED/);
 assert.throws(()=>ctx.subscriptionPayerEmail({},'admin@example.com','',true),/PAYER_EMAIL_REQUIRED_FOR_MASTER/);
});
test('definitive payer rejection releases only its own attempt, while uncertain failures retain idempotency',async()=>{
 const ctx=context();for(const status of [400,503]){let update;const filters=[];const q={eq(k,v){filters.push([k,v]);return q;},then(resolve){resolve({error:null});}};
 const admin={from(table){assert.equal(table,'site_subscriptions');return{update(value){update=value;return q;}};}};
 await assert.rejects(ctx.failSubscriptionCreation(admin,'site-a','attempt-a',status,'User bad request'),new RegExp(status===400?'MP_PAYER_ACCOUNT_REQUIRED':'SUBSCRIPTION_CREATE_FAILED'));
 assert.deepEqual(filters,[['site_id','site-a'],['provider_creation_attempt_id','attempt-a']]);assert.equal(update.provider_creation_claimed_at,null);
 assert.equal(Object.hasOwn(update,'provider_creation_attempt_id'),status===400);
 }
});
test('subscription button sends the chosen payment email and cancellation creates no provider request',async()=>{
 const ui=fs.readFileSync('simple/simple.js','utf8');const body=ui.slice(ui.indexOf('async function startSubscription('),ui.indexOf('function subscriptionGate('));
 for(const chosen of ['payment@example.com',null]){let calls=0;const ctx={setBusy(){},getSession:async()=>({user:{email:'login@example.invalid'}}),window:{mcRequestBillingEmail:async()=>chosen},billingCall:async(action,site,args)=>{calls++;assert.equal(action,'subscription_create');assert.equal(site,'site-a');assert.equal(args.payer_email,chosen);return{checkout_url:'https://www.mercadopago.com.ar/subscriptions/checkout'};},location:{},fail:e=>{throw e;},toast(){}};
 vm.runInNewContext(body,ctx);await ctx.startSubscription('site-a',{});assert.equal(calls,chosen?1:0);
 }
});
