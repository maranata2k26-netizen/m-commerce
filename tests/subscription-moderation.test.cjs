'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module');
for(const name of ['j3-billing','j3-billing-webhook']){
 test(name+': confirmed Simple payment preserves administrative suspension; PRO stays compatible',async()=>{
  const source=fs.readFileSync('supabase/functions/'+name+'/index.ts','utf8');
  const start=source.indexOf('async function paidSiteState'),end=source.indexOf('Deno.serve(',start);
  const fn=vm.runInNewContext(stripTypeScriptTypes(source.slice(start,end))+';paidSiteState');
  for(const tier of ['simple','pro']){
   const q={select(){return this},eq(){return this},async single(){return {data:{product_tier:tier}}}};
   const result=await fn({from(){return q}},'fixture');
   assert.equal(result.subscription_status,tier==='pro'?'active':undefined);
   assert.equal(Object.hasOwn(result,'is_suspended'),tier==='pro');
  }
  const bad={select(){return this},eq(){return this},async single(){return {error:new Error('DB_UNAVAILABLE')}}};
  await assert.rejects(fn({from(){return bad}},'fixture'),/DB_UNAVAILABLE/);
  assert.doesNotMatch(source.slice(0,start),/subscription_status:'active',is_suspended:false/);
 });
}
