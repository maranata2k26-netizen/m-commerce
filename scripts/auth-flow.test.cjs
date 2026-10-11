'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const code=fs.readFileSync(path.join(root,'simple','simple.js'),'utf8');
const html=fs.readFileSync(path.join(root,'simple','index.html'),'utf8');
const config=fs.readFileSync(path.join(root,'simple','simple-official-origin.js'),'utf8');

function isolate(start,end,options={}){
 const a=code.indexOf(start),b=code.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Expected auth function boundaries');
 const fields={email:'owner@example.test',password:'strongpassword22',full_name:'A Person',new_password:'verylongpassword',confirm_password:'verylongpassword'};
 const controls={};
 function element(id){
  if(!controls[id])controls[id]={id,value:fields[id]??'',textContent:'',dataset:{},disabled:false,onsubmit:null,onclick:null};
  return controls[id];
 }
 const actions=[], calls=[],store=new Map();
 const client={
  signUp:async args=>{calls.push(['signup',args]);return options.signup||{data:{user:{identities:[]},session:null},error:null}},
  signInWithPassword:async args=>{calls.push(['login',args]);return{data:{session:{}},error:null}},
  resend:async args=>{calls.push(['resend',args]);return{error:null}},
  resetPasswordForEmail:async(...args)=>{calls.push(['recover',args]);return{error:null}},
  updateUser:async args=>{calls.push(['update',args]);return{error:null}}
 };
 const context={
  app:{innerHTML:''},sb:{auth:client},document:{getElementById:element},
  nav:()=>'<nav></nav>',field:(_name,_label,_type,value)=>'<input value="'+String(value||'')+'">',
  esc:v=>String(v||''),FormData:class{get(name){return fields[name]||''}},
  location:{search:options.search||'',href:'',replace:href=>actions.push(['replace',href])},
  window:{M_COMMERCE_OFFICIAL_ORIGIN:'https://m-commerce-staging.vercel.app'},
  sessionStorage:{setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k)||null},
  setBusy:(b,v)=>{if(b)b.disabled=v;},
  toast:(...x)=>actions.push(['toast',...x]),fail:e=>actions.push(['error',e?.message||String(e)]),
  console:{warn:()=>{},error:()=>{}},URLSearchParams
 };
 vm.runInNewContext(code.slice(a,b),context,{timeout:1500});
 return{context,controls,fields,actions,calls,store};
}
const ev=()=>({preventDefault(){},submitter:{disabled:false,dataset:{},textContent:'Enviar'},currentTarget:{}});

test('obsolete account enumeration monkeypatch is not loaded',()=>{
 assert.doesNotMatch(html,/src="\/simple\/simple-auth-fixes\.js/);
 assert.doesNotMatch(code,/user\?\.identities/);
 assert.match(html,/simple\.js\?v=20261011-(?:auth1|onboarding1)/);
});

test('registration without a session proceeds to a persistent confirmation page (even for obfuscated users)',async()=>{
 const x=isolate('function authView(mode){','async function adminRoute()');
 x.context.authView('register');
 assert.equal(typeof x.controls['auth-form'].onsubmit,'function');
 await x.controls['auth-form'].onsubmit(ev());
 assert.equal(x.calls[0][0],'signup');
 assert.equal(x.actions.find(i=>i[0]==='replace')?.[1],'/simple/app?mode=verify');
 assert.equal(x.store.get('mc_pending_confirmation_email'),'owner@example.test');
});

test('confirmation can resend through staging without exposing account existence',async()=>{
 const x=isolate('function authView(mode){','async function adminRoute()');
 x.context.authView('verify');
 assert.match(x.context.app.innerHTML,/Revisá tu email/);
 await x.controls['confirmation-form'].onsubmit(ev());
 assert.equal(x.calls[0][0],'resend');
 assert.equal(x.calls[0][1].options.emailRedirectTo,'https://m-commerce-staging.vercel.app/simple/app?verified=1');
 assert.match(x.controls['confirmation-status'].textContent,/Si hay una confirmación pendiente/);
});

test('recovery sends an explicit staging callback and does not reveal if email exists',async()=>{
 const x=isolate('function authView(mode){','async function adminRoute()');
 x.context.authView('recover');
 await x.controls['recover-form'].onsubmit(ev());
 assert.equal(x.calls[0][0],'recover');
 assert.equal(x.calls[0][1][1].redirectTo,'https://m-commerce-staging.vercel.app/simple/app?reset=1');
 assert.match(x.controls['recover-status'].textContent,/Si existe una cuenta/);
});

test('password change requires matching confirmation before updating auth',async()=>{
 const x=isolate('function resetPasswordView(){','async function appRoute(){');
 x.context.resetPasswordView();
 x.context.document.getElementById('new_password').value='password-strong';
 x.context.document.getElementById('confirm_password').value='not-the-same';
 await x.controls['reset-form'].onsubmit(ev());
 assert.equal(x.calls.length,0);
 x.context.document.getElementById('confirm_password').value='password-strong';
 await x.controls['reset-form'].onsubmit(ev());
 assert.equal(x.calls.length,1);
 assert.equal(x.calls[0][0],'update');
 assert.equal(x.calls[0][1].password,'password-strong');
 assert.equal(x.actions.find(z=>z[0]==='replace')?.[1],'/simple/app?password_updated=1');
});

test('auth recovery landing does not silently show login for invalid recovery session',async()=>{
 const start='async function appRoute(){',end='function createStoreView(user){';
 const a=code.indexOf(start),b=code.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a);
 const called=[];
 const ctx={
  getSession:async()=>null,location:{search:'?reset=1'},
  authExpiredView:()=>called.push('expired'),resetPasswordView:()=>called.push('reset'),
  authView:()=>called.push('login'),URLSearchParams
 };
 vm.runInNewContext(code.slice(a,b),ctx,{timeout:1500});
 await ctx.appRoute();
 assert.deepEqual(called,['expired']);
});

test('separate staging and production redirect settings are retained',()=>{
 assert.match(config,/m-commerce-staging\.vercel\.app/);
 assert.match(config,/jcgvunffeskkbgsbomgy/);
 assert.match(config,/kjoixhzaxopdbmudzfsg/);
 assert.match(code,/PASSWORD_RECOVERY/);
});

test('login uses password sign-in and returns to the Simple dashboard',async()=>{
 const x=isolate('function authView(mode){','async function adminRoute()');
 x.context.authView('login');
 await x.controls['auth-form'].onsubmit(ev());
 assert.equal(x.calls[0][0],'login');
 assert.equal(x.calls[0][1].email,'owner@example.test');
 assert.equal(x.context.location.href,'/simple/app');
});

test('signup with an immediate valid session skips email verification',async()=>{
 const x=isolate('function authView(mode){','async function adminRoute()',{
  signup:{data:{session:{access_token:'simulated-token'},user:{}},error:null}
 });
 x.context.authView('register');
 await x.controls['auth-form'].onsubmit(ev());
 assert.equal(x.actions.find(z=>z[0]==='replace')?.[1],'/simple/app');
 assert.equal(x.store.has('mc_pending_confirmation_email'),false);
});

test('valid password-recovery link opens the password form instead of normal login',async()=>{
 const start='async function appRoute(){',end='function createStoreView(user){';
 const a=code.indexOf(start),b=code.indexOf(end,a+start.length);
 const called=[],ctx={
  getSession:async()=>({user:{id:'test'}}),location:{search:'?reset=1'},
  authExpiredView:()=>called.push('expired'),resetPasswordView:()=>called.push('reset'),
  authView:()=>called.push('login'),URLSearchParams
 };
 vm.runInNewContext(code.slice(a,b),ctx,{timeout:1500});
 await ctx.appRoute();
 assert.deepEqual(called,['reset']);
});
