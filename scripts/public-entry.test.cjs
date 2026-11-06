'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
async function entry(hostname,pathname='/',search='?source=flyer',hash='#planes'){
 const redirects=[],requests=[],elements={status:{},retry:{style:{}}};
 vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{
  location:{hostname,pathname,search,hash,origin:(hostname==='localhost'?'http://':'https://')+hostname,replace:url=>redirects.push(url)},
  URLSearchParams,AbortController,Date,console,setTimeout:()=>1,clearTimeout(){},
  document:{getElementById:id=>elements[id],open(){},write(){},close(){}},
  fetch:async url=>{requests.push(url);return{ok:true,text:async()=>'<html>Legacy shop</html>'}}
 },{timeout:1000});
 await new Promise(resolve=>setImmediate(resolve));return{redirects,requests};
}
test('official root and index entry reach Simple before loading legacy commerce',async()=>{
 for(const host of ['mcommerce.vercel.app','m-commerce-ar.vercel.app','j3-plataform.vercel.app'])for(const pathname of ['/','/index.html']){
  const r=await entry(host,pathname);assert.deepEqual(r.redirects,['https://mcommerce.vercel.app/simple?source=flyer#planes']);assert.equal(r.requests.length,0);
 }
});
test('staging and preview root entries never load the production runtime',async()=>{
 for(const host of ['m-commerce-staging.vercel.app','m-commerce-abc123xyz-maranata3.vercel.app','m-commerce-git-test-maranata3.vercel.app','localhost']){
  const r=await entry(host);assert.equal(r.requests.length,0,host);assert.deepEqual(r.redirects,[(host==='localhost'?'http://':'https://')+host+'/simple?source=flyer#planes']);
 }
});
test('custom merchant domains preserve their existing legacy storefront entry',async()=>{
 const r=await entry('merchant.example.com');assert.equal(r.redirects.length,0);assert.equal(r.requests.length,1);assert.equal(new URL(r.requests[0]).searchParams.get('path'),'index.html');
});
test('official public roots have server redirects before filesystem index resolution',()=>{
 for(const host of ['mcommerce.vercel.app','m-commerce-staging.vercel.app'])for(const source of ['/','/index.html']){
  const rule=config.redirects.find(r=>r.source===source&&r.has?.some(h=>h.type==='host'&&h.value===host));
  assert.ok(rule,host+source);assert.equal(rule.destination,'/simple');assert.equal(rule.permanent,false);
 }
});
