'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const frontend=fs.readFileSync(path.join(root,'simple','simple.js'),'utf8');
const enhancements=fs.readFileSync(path.join(root,'simple','simple-enhancements-v2.js'),'utf8');
const sql=fs.readFileSync(path.join(root,'supabase','migrations','20261011194500_preserve_published_simple_onboarding.sql'),'utf8');

function variantSerializer(){
 const start=enhancements.indexOf('function variantPayloadFromRow(row,index){');
 const end=enhancements.indexOf('const dash=()=>',start);
 assert.ok(start>=0&&end>start,'expected variant serializer');
 const ctx={};
 vm.runInNewContext(enhancements.slice(start,end),ctx,{timeout:1000});
 return ctx.variantPayloadFromRow;
}
function variantRow(previous,overrides={}){
 const values={'.mc-v-stock':'3','.mc-v-name':'Talle 42 - nuevo nombre','.mc-v-price':'50',...overrides};
 return {_mcExistingVariant:previous,querySelector:(selector)=>({
   value:values[selector],
   checked:selector==='.mc-v-available'?(Object.hasOwn(overrides,selector)?Boolean(overrides[selector]):previous?.available!==false):false
 })};
}

test('renaming an existing variant retains its exact UUID, metadata and stock concurrency snapshot',()=>{
 const serialize=variantSerializer();
 const previous={
  id:'123e4567-e89b-42d3-a456-426614174001',
  name:'Talle 41',stock_tracking:true,stock_quantity:3,
  attributes:{Color:'Negro',Talle:'41'},sku:'SHOP-41',available:true
 };
 const value=serialize(variantRow(previous),0);
 assert.equal(value.id,previous.id);
 assert.equal(value.name,'Talle 42 - nuevo nombre');
 assert.equal(value.stock_quantity,3);
 assert.equal(value.expected_stock_quantity,3);
 assert.equal(value.sku,'SHOP-41');
 assert.equal(value.available,true);
 assert.deepEqual(JSON.parse(JSON.stringify(value.attributes)),previous.attributes);
 assert.equal(value.price_delta,50);
});

test('editing a sold-out variant does not silently reactivate it',()=>{
 const previous={id:'123e4567-e89b-42d3-a456-426614174001',stock_tracking:true,stock_quantity:0,available:false,attributes:{},sku:null};
 const payload=variantSerializer()(variantRow(previous,{'.mc-v-stock':'0'}),0);
 assert.equal(payload.available,false);
 assert.equal(payload.expected_stock_quantity,0);
 assert.equal(payload.stock_quantity,0);
});

test('merchants may explicitly reactivate a restocked variant without changing its ID',()=>{
 const previous={id:'123e4567-e89b-42d3-a456-426614174001',stock_tracking:true,stock_quantity:0,available:false,attributes:{}};
 const restored=variantSerializer()(variantRow(previous,{'.mc-v-stock':'4','.mc-v-available':true}),0);
 assert.equal(restored.id,previous.id);
 assert.equal(restored.expected_stock_quantity,0);
 assert.equal(restored.stock_quantity,4);
 assert.equal(restored.available,true);
});

test('the stock editor rejects malformed quantities before any product RPC',()=>{
 const serialize=variantSerializer();
 for(const stock of ['abc','-1','1.5','1e3']){
  assert.throws(()=>serialize(variantRow(null,{'.mc-v-stock':stock}),0),/stock/i);
 }
 assert.equal(serialize(variantRow(null,{'.mc-v-stock':''}),0).stock_tracking,false);
 assert.equal(serialize(variantRow(null,{'.mc-v-stock':'0'}),0).stock_quantity,0);
 assert.throws(()=>serialize(variantRow(null,{'.mc-v-price':'abc'}),0),/adicional válido/);
});

test('only active variants are loaded and failures are not masked by empty data',()=>{
 assert.match(enhancements,/select\("id,name,price_delta,stock_tracking,stock_quantity,attributes,sort_order,available,sku"\)/);
 assert.match(enhancements,/\.eq\("product_id",editingProductId\)\.eq\("active",true\)/);
 assert.match(enhancements,/if\(variantsResult\.error\)throw variantsResult\.error/);
 assert.match(enhancements,/row\._mcExistingVariant=variant\?\.id/);
 assert.match(enhancements,/variants:variantContext\.variants\.map/);
 assert.match(enhancements,/form\.addEventListener\("submit",event=>/);
 assert.match(enhancements,/event\.stopImmediatePropagation\(\)/);
});

test('products keep free/zero prices, reject empty categories, and reject stale stock updates',()=>{
 assert.match(frontend,/p\.price\?\?""/);
 assert.match(frontend,/if\(categoriesError\)throw categoriesError/);
 assert.match(frontend,/if\(!sel\.value\|\|!opt\)throw new Error/);
 assert.match(frontend,/expected_stock_quantity:p\.stock_quantity/);
 assert.match(frontend,/\.is\("archived_at",null\)/);
});

function setupOrdersPanel(){
 const start=frontend.indexOf('async function ordersPanel(panel,siteId){');
 const end=frontend.indexOf('async function paymentsPanel(',start);
 assert.ok(start>=0&&end>start,'orders panel section expected');
 const order={id:'123e4567-e89b-42d3-a456-426614174001',order_number:23,
  customer_name:'Cliente de prueba',status:'new',payment_method:'cash',payment_status:'unpaid',
  delivery_method:'pickup',total:1500,created_at:'2026-10-11T10:00:00Z'};
 const select={value:'new',dataset:{id:order.id},disabled:false,onchange:null};
 let errors=[],notices=[],calls=[],failNext=true;
 const panel={innerHTML:'',querySelectorAll:k=>k==='.order-status'?[select]:[]};
 const supabase={
  from(table){
   return{
    select(){return this},eq(){return this},order(){return this},
    limit:async()=>({data:[order],error:null}),
    in:async()=>({data:[{order_id:order.id,product_name:'Producto',quantity:1,line_total:1500,variant_name:'Azul'}],error:null})
   };
  }
 };
 const ctx={sb:supabase,esc:x=>String(x),money:v=>'$'+v,
  rpc:async(name,arg)=>{calls.push({name,arg});if(failNext){failNext=false;throw Error('PAYMENT_NOT_APPROVED')}return{status:arg.p_status}},
  fail:e=>errors.push(e.message),toast:x=>notices.push(x),Date};
 vm.runInNewContext(frontend.slice(start,end),ctx,{timeout:1000});
 return {run:()=>ctx.ordersPanel(panel,'123e4567-e89b-42d3-a456-426614174002'),select,panel,calls,errors,notices};
}

test('order status change rolls back visually if the server rejects it',async()=>{
 const h=setupOrdersPanel();
 await h.run();
 assert.equal(h.select.dataset.savedStatus,'new');
 h.select.value='ready';
 await h.select.onchange();
 assert.equal(h.select.value,'new');
 assert.equal(h.select.disabled,false);
 assert.match(h.errors[0],/PAYMENT_NOT_APPROVED/);
 assert.equal(h.notices.length,0);
 h.select.value='preparing';
 await h.select.onchange();
 assert.equal(h.select.value,'preparing');
 assert.equal(h.select.dataset.savedStatus,'preparing');
 assert.equal(h.select.disabled,false);
 assert.equal(h.notices.length,1);
 assert.equal(h.calls[1].name,'platform_update_order_status');
});

test('finishing or editing published Simple store cannot unpublish it',()=>{
 assert.match(sql,/status=case when v_site\.status='published' then 'published' else 'draft' end/);
 assert.match(sql,/jsonb_build_object\('status',v_site\.status\)/);
 assert.match(sql,/'status',v_site\.status,'preview_url'/);
 assert.doesNotMatch(sql,/status='draft', last_activity_at/);
});

test('contact and the previous checkout are preserved on this stacked branch',()=>{
 assert.equal((frontend.match(/5491162760623/g)||[]).length,7);
 assert.match(frontend,/checkoutAttemptId=crypto\.randomUUID\(\)/);
 assert.match(frontend,/cart\.find\(i=>i\.key===b\.dataset\.key\)/);
 assert.match(frontend,/platform_update_order_status/);
});
