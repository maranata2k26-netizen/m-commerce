'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const main=fs.readFileSync(path.join(root,'simple/simple.js'),'utf8');
const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261012214500_simple_notification_inbox.sql'),'utf8');
const regress=fs.readFileSync(path.join(root,'supabase/tests/simple-notifications-staging.sql'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/validate-simple.yml'),'utf8');
const html=fs.readFileSync(path.join(root,'simple/index.html'),'utf8');
const start=main.indexOf('async function notificationsPanel('),end=main.indexOf('async function ordersPanel(',start);
assert.ok(start>=0&&end>start,'Notification panel must exist');
const snippet=main.slice(start,end);
const ownId='123e4567-e89b-42d3-a456-426614174005';

function fixture(overrides={}){
 return {id:ownId,order_id:'123e4567-e89b-42d3-a456-426614174002',
  title:'Nuevo pedido',message:'Pedido 420 preparado',
  kind:'order',created_at:'2026-10-12T20:33:00Z',read_at:null,...overrides};
}
function harness(options={}){
 let source=options.items||[fixture()];
 const calls=[],alerts=[],warnings=[],elements=new Map();
 let markup='',marks=[];
 const panel={
  set innerHTML(value){markup=value;elements.clear();marks=[];
   if(markup.includes('notification-mark')){
    marks=[...markup.matchAll(/class="mini notification-mark" data-id="([^"]+)"/g)]
      .map(m=>({dataset:{id:m[1]},disabled:false,textContent:'Marcar como leído',onclick:null}));
   }
  },
  get innerHTML(){return markup},
  querySelector(id){if(!elements.has(id))elements.set(id,{id,disabled:false,textContent:'Actualizar',onclick:null});return elements.get(id)},
  querySelectorAll(css){return css==='.notification-mark'?marks:css==='.notification-orders'?(markup.includes('notification-orders')?[{onclick:null}]:[]):[]}
 };
 const ctx={
  rpc:async(name,args)=>{
    calls.push({name,args});
    if(name==='simple_my_notifications'){
     if(options.failLoad)throw Error('NETWORK_UNAVAILABLE');
     return source.map(x=>({...x}));
    }
    if(name==='simple_mark_notification_read'){
     if(options.failMark)throw Error('NETWORK_UNAVAILABLE');
     source=source.map(x=>x.id===args.p_notification_id?{...x,read_at:'2026-10-12T21:00:00Z'}:x);
     return {id:args.p_notification_id,read_at:'2026-10-12T21:00:00Z'};
    }
    throw Error('Unexpected RPC: '+name);
  },
  esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  setBusy:(button,flag)=>{button.disabled=flag;},
  fail:error=>alerts.push(error?.message||String(error)),
  ordersPanel:async()=>{},
  console:{warn:(...parts)=>warnings.push(parts.join(':'))},
  Date,Number,Array,JSON
 };
 vm.runInNewContext(snippet,ctx,{timeout:2000});
 return {init:()=>ctx.notificationsPanel(panel,'site-123',{}),panel,calls,alerts,warnings,get mark(){return marks[0];}};
}
test('merchant panel safely renders only its own alerts with escaped content',async()=>{
 const h=harness({items:[fixture({title:'<script>alert(1)</script>',message:'<img src=x onerror=bad()>'})]});
 await h.init();
 assert.match(h.panel.innerHTML,/&lt;script&gt;/);
 assert.match(h.panel.innerHTML,/&lt;img/);
 assert.doesNotMatch(h.panel.innerHTML,/<script>/);
 assert.doesNotMatch(h.panel.innerHTML,/<img src=x onerror/);
 assert.match(h.panel.innerHTML,/1 sin leer/);
 assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0])),{name:'simple_my_notifications',args:{p_site_id:'site-123',p_limit:60}});
});
test('mark-as-read waits for backend acknowledgment and hides only the acknowledged action',async()=>{
 const h=harness();await h.init();const mark=h.mark;
 assert.equal(typeof mark.onclick,'function');
 await mark.onclick();
 assert.equal(h.calls[1].name,'simple_mark_notification_read');
 assert.equal(h.calls[1].args.p_site_id,'site-123');
 assert.equal(h.calls[1].args.p_notification_id,ownId);
 assert.match(h.panel.innerHTML,/0 sin leer/);
 assert.match(h.panel.innerHTML,/>Leído</);
 assert.equal(h.alerts.length,0);
});
test('failure to mark a notification cannot falsely mark it read',async()=>{
 const h=harness({failMark:true});await h.init();await h.mark.onclick();
 assert.match(h.panel.innerHTML,/1 sin leer/);
 assert.equal(h.alerts.length,1);
});
test('inbox outage exposes a retry action, not an invented empty history',async()=>{
 const h=harness({failLoad:true});await h.init();
 assert.match(h.panel.innerHTML,/No se pudieron cargar los avisos/);
 assert.doesNotMatch(h.panel.innerHTML,/No hay avisos para esta tienda/);
 assert.equal(typeof h.panel.querySelector('#notification-retry').onclick,'function');
});
test('SQL schema revokes direct access, locks to tenant and creates duplicate-proof events',()=>{
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.simple_notifications/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON public\.simple_notifications FROM PUBLIC, anon, authenticated/);
 assert.match(sql,/UNIQUE\(site_id,event_key\)/);
 assert.match(sql,/ON CONFLICT\(site_id,event_key\) DO NOTHING/);
 assert.match(sql,/public\.platform_is_site_member\(p_site_id\)/);
 assert.match(sql,/WHERE site_id=p_site_id/);
 assert.match(sql,/AND site_id=p_site_id/);
 assert.match(sql,/simple_notification_order_payment/);
 assert.match(sql,/simple_notification_subscription_status/);
 assert.match(sql,/NEW\.payment_status='approved'/);
 assert.match(sql,/OLD\.payment_status IS DISTINCT FROM NEW\.payment_status/);
 assert.match(sql,/EXCEPTION WHEN OTHERS/);
 assert.doesNotMatch(sql,/http_post|smtp|send_mail|resend\.com|service_role_key/i);
});
test('staging tenant regression covers foreign inbox, ACK rejection and no real emails',()=>{
 assert.match(regress,/^BEGIN;/m);assert.match(regress,/^ROLLBACK;/m);
 for(const name of ['FOREIGN_INBOX_EXPOSED','FOREIGN_NOTIFICATION_MODIFIED',
  'UNEXPECTED_NOTIFICATION_COUNT','ANONYMOUS_CAN_READ_INBOX','DIRECT_INBOX_LEAK']){
  assert.match(regress,new RegExp(name));
 }
 assert.match(regress,/ON CONFLICT\(site_id,event_key\) DO NOTHING/);
 assert.match(workflow,/node --test scripts\/simple-notifications\.test\.cjs/);
});
test('registration and recovery preserve Supabase-managed mail flows and safe redirects',()=>{
 assert.match(main,/sb\.auth\.signUp/);
 assert.match(main,/sb\.auth\.resend/);
 assert.match(main,/sb\.auth\.resetPasswordForEmail/);
 assert.match(main,/M_COMMERCE_OFFICIAL_ORIGIN\+"\/simple\/app\?reset=1"/);
 assert.match(main,/M_COMMERCE_OFFICIAL_ORIGIN\+"\/simple\/app\?verified=1"/);
 assert.match(main,/No pudimos validar el enlace/);
 assert.match(html,/simple\/simple\.js\?v=/);
});
