'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const full=fs.readFileSync(path.join(root,'simple','simple.js'),'utf8');
const start=full.indexOf('async function wizard(siteId,step=1,dash=null){');
const end=full.indexOf('async function optimizeImage(',start);
assert.ok(start>=0&&end>start,'wizard implementation must exist');
const code=full.slice(start,end);
const siteId='00000000-0000-4000-8000-000000000001';

const slugify=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function harness(options={}){
 const opts={step:1,status:'draft',slug:'tienda-aaaaaaaaaaaa',categories:[],products:[],failFinishOnce:false,...options};
 const categories=opts.categories.map((id,i)=>({id:id||'category-'+i,name:'Ropa',active:true}));
 const products=opts.products.map((id,i)=>({id:id||'product-'+i,name:'Campera',active:true}));
 const calls=[],errors=[],elements={};
 const store={
   site:{id:siteId,status:opts.status,slug:opts.slug,name:'Mi tienda'},
   settings:{business_name:'Mi tienda',whatsapp_number:'1162760623',payment_methods:{cash:true},fulfillment_config:{pickup_enabled:true}},
   counts:{categories:categories.length,products:products.length},
   subscription:{status:'trial'}
 };
 const values={w_name:'Mi tienda',w_slug:opts.slug==='tienda-aaaaaaaaaaaa'?'mi-tienda':opts.slug,w_first_category:'Ropa',w_product_name:'Remera',w_product_price:'1000'};
 function field(name,label,type,value){return '<input id="'+name+'" value="'+String(value||'')+'">';}
 function el(id){if(!elements[id])elements[id]={id,value:values[id]||'',files:[],dataset:{},textContent:'',disabled:false,onclick:null,onsubmit:null,oninput:null};return elements[id];}
 const db={from(name){const obj={
   select(){return this;},eq(){return this;},is(){return this;},order(){return this;},limit(){return this;},
   then(resolve){const data=name==='product_categories'?categories:products;return Promise.resolve({data,error:null}).then(resolve);}
 };return obj;}};
 let finishTries=0;
 async function rpc(name,args){
   calls.push({name,args});
   if(name==='simple_upsert_category'){categories.push({id:'cat-created',name:args.p_category.name,active:true});return{id:'cat-created'};}
   if(name==='simple_upsert_product'){products.push({id:'prod-created',name:args.p_product.name,active:true});return{id:'prod-created'};}
   if(name==='simple_save_store_profile'&&opts.failSaveOnce){opts.failSaveOnce=false;throw Error('SIMULATED_SAVE_ERROR');}
   if(name==='simple_complete_onboarding'){finishTries++;return opts.failFinishOnce&&finishTries===1?{ready:false,missing:['mock retry']}:{ready:true};}
   if(name==='simple_set_draft_slug'){store.site.slug=args.p_slug;return{slug:args.p_slug};}
   if(name==='platform_my_sites')return [store.site];
   throw Error('Unexpected RPC '+name);
 }
 const context={
   sb:db,app:{innerHTML:''},window:{M_COMMERCE_OFFICIAL_ORIGIN:'https://m-commerce-staging.vercel.app'},
   document:{getElementById:el,querySelectorAll:()=>[]},
   rpc,slugify,esc:v=>String(v??''),field,money:n=>String(n),logout(){},
   toast(){},fail:e=>errors.push(e.message),setBusy:(b,on)=>{if(b)b.disabled=on;},
   upload:async()=>'',dashboard:async()=>{calls.push({name:'dashboard'});}
 };
 vm.runInNewContext(code,context,{timeout:1500});
 return{async init(){await context.wizard(siteId,opts.step,store);return this;},
   context,elements,calls,errors,categories,products,store};
}
const submit=()=>({preventDefault(){},submitter:{disabled:false,textContent:'Continuar',dataset:{}}});

test('draft store owner sees a selectable clean URL and first name suggestion',async()=>{
 const h=await harness().init();
 assert.match(h.context.app.innerHTML,/id="w_slug"/);
 const slug=h.context.document.getElementById('w_slug'),name=h.context.document.getElementById('w_name');
 name.value='Casa de Joaco';name.oninput();
 assert.equal(slug.value,'casa-de-joaco');
 slug.value='Tienda Joaco premium';slug.oninput();
 assert.equal(slug.value,'tienda-joaco-premium');
 await h.elements.wizard.onsubmit(submit());
 assert.equal(h.calls.filter(x=>x.name==='simple_set_draft_slug').length,1);
 assert.equal(h.store.site.slug,'tienda-joaco-premium');
 assert.match(h.context.app.innerHTML,/Paso 2 de 10/);
});

test('a published store never exposes an editable URL nor calls slug mutation',async()=>{
 const h=await harness({status:'published',slug:'mi-tienda-publicada'}).init();
 assert.doesNotMatch(h.context.app.innerHTML,/id="w_slug"/);
 await h.elements.wizard.onsubmit(submit());
 assert.equal(h.calls.filter(x=>x.name==='simple_set_draft_slug').length,0);
 assert.equal(h.store.site.slug,'mi-tienda-publicada');
});

test('an already active category or product is not added again',async()=>{
 const category=await harness({step:9,categories:['existing-cat']}).init();
 assert.match(category.context.app.innerHTML,/Ya tenés categorías/);
 await category.elements.wizard.onsubmit(submit());
 assert.equal(category.calls.filter(x=>x.name==='simple_upsert_category').length,0);
 const product=await harness({step:10,categories:['existing-cat'],products:['existing-product']}).init();
 assert.match(product.context.app.innerHTML,/Ya tenés productos/);
 await product.elements.wizard.onsubmit(submit());
 assert.equal(product.calls.filter(x=>x.name==='simple_upsert_product').length,0);
 assert.equal(product.calls.filter(x=>x.name==='simple_complete_onboarding').length,1);
});

test('repeating the last onboarding step after an incomplete response does not duplicate its product',async()=>{
 const h=await harness({step:10,categories:['existing-cat'],failFinishOnce:true}).init();
 await h.elements.wizard.onsubmit(submit());
 assert.equal(h.products.length,1);
 assert.equal(h.errors.length,1);
 await h.elements.wizard.onsubmit(submit());
 assert.equal(h.products.length,1);
 assert.equal(h.calls.filter(x=>x.name==='simple_upsert_product').length,1);
 assert.equal(h.calls.filter(x=>x.name==='simple_complete_onboarding').length,2);
});

test('repeating category step after a failed progress save cannot add it twice',async()=>{
 const h=await harness({step:9,failSaveOnce:true}).init();
 await h.elements.wizard.onsubmit(submit());
 assert.equal(h.categories.length,1);
 await h.elements.wizard.onsubmit(submit());
 assert.equal(h.categories.length,1);
 assert.equal(h.calls.filter(x=>x.name==='simple_upsert_category').length,1);
});

test('slug RPC is restricted to the draft owner with a unique lowercased URL',()=>{
 const sql=fs.readFileSync(path.join(root,'supabase','migrations','20261011171100_simple_draft_slug_control.sql'),'utf8');
 assert.match(sql,/owner_id=v_user AND product_tier='simple'/);
 assert.match(sql,/v_site.status <> 'draft'/);
 assert.match(sql,/sites_slug_lower_unique/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.simple_set_draft_slug\(uuid,text\) FROM PUBLIC,anon,authenticated/i);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.simple_set_draft_slug\(uuid,text\) TO authenticated,service_role/i);
 assert.match(sql,/not coalesce\(v_site.metadata \? 'auto_slug',false\)/);
});

test('the previously published Joaco contact remains intact after the onboarding changes',()=>{
 assert.equal((full.match(/5491162760623/g)||[]).length,7);
 assert.doesNotMatch(full,/5493329698591|Hablá con Ema/);
});
