'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const base=process.env.MC_STAGING_BASE_URL||'https://m-commerce-staging.vercel.app';
const normalized=v=>v.replace(/\r\n/g,'\n');const digest=v=>createHash('sha256').update(normalized(v)).digest('hex');
(async()=>{for(const file of ['simple/index.html','simple/simple.js','simple/simple-bootstrap.js','simple/simple-enhancements-v2.js','simple/simple-official-origin.js','simple/simple-location-v4.js','simple/simple.css']){
 const r=await fetch(base+'/'+file,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(15000)});assert.equal(r.status,200,file+': unexpected response');assert.equal(digest(await r.text()),digest(fs.readFileSync(file,'utf8')),file+': live staging differs from candidate');console.log('MATCH '+file);
}})().catch(e=>{console.error(e.message);process.exitCode=1;});
