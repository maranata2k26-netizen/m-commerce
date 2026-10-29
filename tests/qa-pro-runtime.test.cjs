const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'../supabase/functions/qa-pro-runtime/index.ts'),'utf8');
const stage='https://jcgvunffeskkbgsbomgy.supabase.co',key='sb_publishable_5TX-YZ5p7yiZHZDAjQSGXg_c29FCBQ8';
function harness(options={}){
 let handler,queries=0;
 const content=options.content??'window.J3_CONFIG={SUPABASE_URL:"'+stage+'"};';
 const row={content,content_type:'application/javascript',sha256:options.hash??crypto.createHash('sha256').update(content).digest('hex')};
 const context={Deno:{env:{get:name=>name==='SUPABASE_URL'?(options.url||stage):'private-server-key'},serve:h=>handler=h},createClient:()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>{queries++;return{data:row,error:null}}})})})}),Response,Request,URL,Set,Uint8Array,TextEncoder,crypto:crypto.webcrypto};
 vm.runInNewContext(stripTypeScriptTypes(source.replace(/^import .*;\s*$/gm,'')),context);
 return {call:(path='config.js',headers={apikey:key},method='GET')=>handler(new Request(stage+'/functions/v1/qa-pro-runtime?path='+encodeURIComponent(path),{headers,method})),queries:()=>queries};
}
test('QA runtime refuses every production environment before querying',async()=>{const h=harness({url:'https://kjoixhzaxopdbmudzfsg.supabase.co'});assert.equal((await h.call()).status,404);assert.equal(h.queries(),0);});
test('QA runtime requires the staging public API key',async()=>{const h=harness();assert.equal((await h.call('config.js',{})).status,401);assert.equal(h.queries(),0);});
test('QA runtime rejects another browser origin',async()=>{const h=harness();assert.equal((await h.call('config.js',{apikey:key,origin:'https://example.invalid'})).status,403);assert.equal(h.queries(),0);});
test('QA runtime serves a verified isolated snapshot',async()=>{const h=harness(),r=await h.call();assert.equal(r.status,200);assert.match(await r.text(),/jcgvunffeskkbgsbomgy/);});
test('QA runtime blocks tampered snapshots and production references',async()=>{assert.equal((await harness({hash:'0'.repeat(64)}).call()).status,503);const h=harness({content:'https://kjoixhzaxopdbmudzfsg.supabase.co'});assert.match(await(await h.call()).text(),/PRODUCTION_REFERENCE_BLOCKED/);});
test('QA runtime never accepts an arbitrary file path',async()=>{const h=harness();assert.equal((await h.call('../secrets')).status,404);assert.equal(h.queries(),0);});
test('QA runtime preflight is a valid empty response',async()=>{const h=harness(),r=await h.call('config.js',{},'OPTIONS');assert.equal(r.status,204);assert.equal(await r.text(),'');});
test('QA browser entry cannot boot on production',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../qa-pro-bootstrap.html'),'utf8'),calls=[];
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 vm.runInNewContext(script,{location:{hostname:'mcommerce.vercel.app',replace:x=>calls.push(x)},fetch:()=>{throw Error('Must never fetch staging from production')}});
 assert.deepEqual(calls,['/simple']);
 const config=JSON.parse(fs.readFileSync(path.join(__dirname,'../vercel.json'),'utf8'));
 const csp=config.headers.find(x=>x.source==='/qa-pro/:path*').headers.find(x=>x.key==='Content-Security-Policy').value;
 assert.doesNotMatch(csp,/kjoixhzaxopdbmudzfsg/);
});
