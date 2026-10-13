const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const {webcrypto}=require('node:crypto');
const siteId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const orderId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function fixture(tier='simple',rpcError=null){
 let handler,preference,created=0;
 const site={id:siteId,slug:'fixture-store',product_tier:tier,status:'published',subscription_status:'trial',default_payment_provider:'mercadopago',currency_code:'ARS'};
 const admin={from(table){const q={select(){return q},eq(){return q},update(){return q},maybeSingle:async()=>({data:table==='sites'?site:{status:'connected',access_token:'FAKE_TEST_ONLY'},error:null}),then(resolve,reject){return Promise.resolve({data:null,error:null}).then(resolve,reject)}};return q;},async rpc(name){if(name==='checkout_rate_limit_v19')return {data:true};if(name==='create_checkout_order_v117'){if(rpcError)return {error:rpcError};created++;return {data:{id:orderId,total:120,tracking_token:'FAKE_TRACKING',order_number:1}};}throw Error('Unexpected RPC '+name);}};
 vm.runInNewContext(stripTypeScriptTypes(fs.readFileSync('supabase/functions/checkout-create/index.ts','utf8').replace(/^import .*;\r?\n/gm,'')),{URL,Request,Response,Date,Uint8Array,TextEncoder,crypto:webcrypto,console:{error(){},warn(){}},Deno:{env:{get(name){return {SUPABASE_URL:'https://stage.example.invalid',SUPABASE_SERVICE_ROLE_KEY:'FAKE',M_COMMERCE_PUBLIC_ORIGIN:'https://preview.example.invalid'}[name]}},serve(fn){handler=fn}},createClient(){return admin},async fetch(url,options){assert.equal(url,'https://api.mercadopago.com/checkout/preferences');preference=JSON.parse(options.body);return new Response(JSON.stringify({id:'TEST_PREFERENCE',init_point:'https://provider.example.invalid/checkout'}),{status:201});}});
 const body={site_id:siteId,checkout_attempt_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',customer_name:'Cliente ficticio',customer_phone:'1122223333',payment_method:'mercadopago',items:[{product_id:orderId,quantity:1}]};
 return {call(origin='https://preview.example.invalid',overrides={}){return handler(new Request('https://stage.example.invalid/functions/v1/checkout-create',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({...body,...overrides})}));},preference:()=>preference,created:()=>created};
}
test('El pago vuelve a la tienda Simple o Pro dentro del origen configurado de staging',async()=>{
 for(const tier of ['simple','pro']){const f=fixture(tier),r=await f.call();assert.equal(r.status,201);const p=f.preference();assert.equal(p.notification_url,'https://stage.example.invalid/functions/v1/mercadopago-webhook?site_id='+siteId);for(const state of ['success','pending','failure']){const u=new URL(p.back_urls[state]);assert.equal(u.origin,'https://preview.example.invalid');assert.equal(u.pathname,tier==='simple'?'/tienda/fixture-store':'/');assert.equal(u.searchParams.get('order'),orderId);}assert.equal(p.external_reference,orderId);assert.equal(p.metadata.site_id,siteId);}
});
test('Origen no autorizado y solicitud incompleta no crean pedidos ni preferencias',async()=>{
 const unauthorized=fixture();assert.equal((await unauthorized.call('https://other.example.invalid')).status,403);assert.equal(unauthorized.created(),0);assert.equal(unauthorized.preference(),undefined);
 const invalid=fixture();assert.equal((await invalid.call(undefined,{checkout_attempt_id:''})).status,422);assert.equal(invalid.created(),0);assert.equal(invalid.preference(),undefined);
});
test('Errores de Supabase se traducen sin exponer detalles internos',async()=>{
 const f=fixture('simple',{message:'variant_required',details:'PRIVATE_INTERNAL_DETAIL'}),r=await f.call();assert.equal(r.status,400);const body=await r.json();assert.equal(body.message,'Elegí una variante antes de continuar.');assert.equal(JSON.stringify(body).includes('PRIVATE_INTERNAL_DETAIL'),false);assert.equal(f.created(),0);
});
