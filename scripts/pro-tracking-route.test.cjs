const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'bootstrap.html'),'utf8');
test('legacy PRO tracking URL is routed to its dedicated runtime page',async()=>{
 const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
 for(const route of ['/seguimiento','/seguimiento.html'])assert.equal(config.rewrites.find(x=>x.source===route)?.destination,'/bootstrap.html');
 const requests=[],writes=[],elements={status:{},retry:{style:{}}};
 vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{location:{hostname:'mcommerce.vercel.app',pathname:'/seguimiento',search:'?token=qa-tracking-token',hash:''},URLSearchParams,AbortController,document:{getElementById:id=>elements[id],open(){},write:s=>writes.push(s),close(){}},setTimeout:()=>1,clearTimeout(){},Date,console,fetch:async url=>{requests.push(url);return{ok:true,text:async()=>'<html><body>Tracking</body></html>'}}});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(new URL(requests[0]).searchParams.get('path'),'seguimiento.html');assert.equal(writes.length,1);
});
