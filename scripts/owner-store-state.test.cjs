const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../simple/simple-bootstrap.js'),'utf8');
const body=src.slice(src.indexOf('function enhanceDashboard(dash){'),src.indexOf('async function maybeFinishPublish(dash){'));
function render(status,subscription,suspended=false){
 const card={},badge={classList:{toggle(){}}},host={querySelector:q=>q==='.welcome .status'?badge:{after(){}}};
 const ctx={document:{querySelector:()=>host,getElementById:()=>null,createElement:()=>card},official:x=>x,encodeURIComponent};
 vm.runInNewContext(body,ctx);ctx.enhanceDashboard({site:{id:'qa',slug:'qa',status,is_suspended:suspended,simple_onboarding_completed_at:'2026-10-29'},subscription:{status:subscription}});return {html:card.innerHTML,badge};
}
test('cancelled subscription never advertises the published store as available to buyers',()=>{
 const r=render('published','cancelled');assert.match(r.html,/Tu tienda está pausada/);assert.doesNotMatch(r.html,/Tu tienda está online|ABRIR MI TIENDA|Los clientes ya pueden verla/);assert.match(r.html,/REACTIVAR MI TIENDA/);assert.equal(r.badge.textContent,'cancelled');
});
test('active published store retains sharing and public-store access',()=>{const r=render('published','active');assert.match(r.html,/Tu tienda está online/);assert.match(r.html,/ABRIR MI TIENDA/);});
test('administrative suspension cannot offer publishing or buyer availability',()=>{const r=render('published','active',true);assert.match(r.html,/La tienda está suspendida/);assert.doesNotMatch(r.html,/ABRIR MI TIENDA|id="mc-publish"|Los clientes ya pueden verla/);});
test('pending draft keeps preview and accurately labels the subscription',()=>{const r=render('draft','pending');assert.match(r.html,/Tu tienda está en borrador/);assert.match(r.html,/PUBLICAR MI TIENDA/);assert.equal(r.badge.textContent,'pending');});
