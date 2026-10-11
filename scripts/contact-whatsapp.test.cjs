'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const page=fs.readFileSync(path.join(__dirname,'..','simple','simple.js'),'utf8');
const phone='5491162760623';
const links=[...page.matchAll(/href="(https:\/\/wa\.me\/[^"]+)"/g)].map(x=>x[1]);

test('all M Commerce contact buttons route to Joaco WhatsApp',()=>{
  assert.equal(links.length,7,'the landing, header, PRO and floating contacts should be covered');
  for(const link of links){
    const url=new URL(link);
    assert.equal(url.hostname,'wa.me');
    assert.equal(url.pathname,'/'+phone);
    assert.match(url.searchParams.get('text')||'',/Hola Joaco,/);
  }
});

test('visible CTAs and accessibility labels use Joaco, including PRO page',()=>{
  assert.match(page,/<span>Hablá con Joaco<\/span>/);
  assert.match(page,/<span>Hablá con Joaco por PRO<\/span>/);
  assert.match(page,/>Hablá con Joaco por WhatsApp<\/a>/);
  assert.match(page,/aria-label="Hablar con Joaco por WhatsApp"/);
  assert.match(page,/hablá con Joaco si necesitás una solución PRO/);
});

test('remove the previous Ema phone, CTA and prefilled message without changing form email labels',()=>{
  assert.doesNotMatch(page,/5493329698591|Hola%20Ema|Hablá con Ema|Hablar con Ema|hablá con Ema/);
  assert.match(page,/field\("lead_email","Email"/);
});
