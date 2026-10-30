const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const migration=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261029185257_pro_currency_fraction_digits.sql'),'utf8');
async function setup(content){const db=new PGlite();await db.exec('CREATE TABLE public.platform_runtime_files(path text primary key,content text,sha256 text,updated_at timestamptz);');await db.query('INSERT INTO public.platform_runtime_files(path,content) VALUES ($1,$2)',['platform.js',content]);return db;}
test('PRO runtime migration preserves decimal prices, hashes content and is idempotent',async()=>{
 const original="const money=n=>new Intl.NumberFormat(moneyLocale,{style:'currency',currency:moneyCurrency,maximumFractionDigits:0}).format(Number(n||0));";
 const db=await setup(original);try{
  await db.exec(migration);const first=(await db.query("SELECT content,sha256 FROM public.platform_runtime_files WHERE path='platform.js'")).rows[0];
  const context={Intl,moneyLocale:'es-AR',moneyCurrency:'ARS'};vm.runInNewContext(first.content+';globalThis.format=money;',context);
  assert.equal(context.format(123.45),new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(123.45));
  assert.equal(context.format(0),new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(0));
  assert.equal(first.sha256,crypto.createHash('sha256').update(first.content).digest('hex'));
  await db.exec(migration);assert.deepEqual((await db.query("SELECT content,sha256 FROM public.platform_runtime_files WHERE path='platform.js'")).rows[0],first);
 }finally{await db.close();}
});
test('PRO runtime migration stops when the source formatter has drifted',async()=>{
 const db=await setup('unrecognized runtime');try{await assert.rejects(()=>db.exec(migration),/PRO_CURRENCY_FORMAT_DRIFT/);assert.equal((await db.query('SELECT content FROM public.platform_runtime_files')).rows[0].content,'unrecognized runtime');}finally{await db.close();}
});
