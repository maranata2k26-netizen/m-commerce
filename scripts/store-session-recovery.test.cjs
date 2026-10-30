const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../simple/simple.js'),'utf8');
function extract(start,end){const a=code.indexOf(start),b=code.indexOf(end,a+start.length);assert.ok(a>=0&&b>a);return code.slice(a,b);}
test('store lookup failure cannot be mistaken for a new account without a store',async()=>{
 const error={message:'SITE_ACCESS_DENIED'};const calls=[];
 const context={location:{search:'',hash:''},URLSearchParams,getSession:async()=>({user:{id:'qa'}}),rpc:async()=>{throw error},createStoreView:()=>calls.push('create'),storeAccessErrorView:e=>calls.push(e)};
 vm.runInNewContext(extract('async function appRoute(){','function storeAccessErrorView(error){'),context);
 await context.appRoute();assert.deepEqual(calls,[error]);
});
test('dashboard access denial exits loading into a recoverable screen',async()=>{
 const error={message:'SITE_ACCESS_DENIED'};let shown;
 const context={rpc:async()=>{throw error},storeAccessErrorView:e=>shown=e};
 vm.runInNewContext(extract('async function dashboard(site){','const menu='),context);
 await context.dashboard({id:'qa'});assert.equal(shown,error);
});
test('permission and network screens both allow retry and sign out without changing permissions',()=>{
 for(const message of ['SITE_ACCESS_DENIED','Network failure']){
  const controls={},calls=[];
  const context={app:{innerHTML:''},nav:()=>'',console:{warn(){}},document:{getElementById:id=>controls[id]??=( {})},location:{reload:()=>calls.push('reload')},logout:()=>calls.push('logout')};
  vm.runInNewContext(extract('function storeAccessErrorView(error){','function createStoreView(user){'),context);
  context.storeAccessErrorView({message});
  assert.match(context.app.innerHTML,/Salir de esta cuenta/);assert.doesNotMatch(context.app.innerHTML,/Cargando M Commerce|SITE_ACCESS_DENIED/);
  controls['store-access-retry'].onclick();controls['store-access-logout'].onclick();assert.deepEqual(calls,['reload','logout']);
 }
});
