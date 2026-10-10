'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const source = read('simple/simple-official-origin.js');
const configAt = hostname => {
  const window = { location: { hostname } };
  vm.runInNewContext(source, { window }, { timeout: 500 });
  return window;
};

test('staging, previews and localhost use ONLY the isolated Supabase project', () => {
  for (const host of ['m-commerce-staging.vercel.app', 'm-commerce-staging-git-fix-123.vercel.app', 'm-commerce-git-fix-branch-maranata3.vercel.app', 'm-commerce-abc123xyz-maranata3.vercel.app', 'm-commerce-staging-abc123xyz-maranata3.vercel.app', 'localhost', '127.0.0.1']) {
    const cfg = configAt(host);
    assert.equal(cfg.M_COMMERCE_IS_STAGING, true, host);
    assert.equal(cfg.M_COMMERCE_SUPABASE_URL, 'https://jcgvunffeskkbgsbomgy.supabase.co', host);
    assert.equal(cfg.M_COMMERCE_OFFICIAL_ORIGIN, 'https://m-commerce-staging.vercel.app', host);
    assert.match(cfg.M_COMMERCE_SUPABASE_KEY, /^sb_publishable_/, host);
  }
});

test('production origins continue to use the original production Supabase project', () => {
  for (const host of ['mcommerce.vercel.app', 'm-commerce-ar.vercel.app', 'm-commerce-maranata3.vercel.app', 'merchant.example.com']) {
    const cfg = configAt(host);
    assert.equal(cfg.M_COMMERCE_IS_STAGING, false, host);
    assert.equal(cfg.M_COMMERCE_SUPABASE_URL, 'https://kjoixhzaxopdbmudzfsg.supabase.co', host);
    assert.equal(cfg.M_COMMERCE_OFFICIAL_ORIGIN, 'https://mcommerce.vercel.app', host);
    assert.match(cfg.M_COMMERCE_SUPABASE_KEY, /^sb_publishable_/, host);
  }
});

test('staging and production use distinct public credentials', () => {
  const stage = configAt('m-commerce-staging.vercel.app');
  const prod = configAt('mcommerce.vercel.app');
  assert.notEqual(stage.M_COMMERCE_SUPABASE_URL, prod.M_COMMERCE_SUPABASE_URL);
  assert.notEqual(stage.M_COMMERCE_SUPABASE_KEY, prod.M_COMMERCE_SUPABASE_KEY);
});

test('Simple clients, checkout and billing never hardcode the production backend', () => {
  for (const name of ['simple.js', 'simple-bootstrap.js', 'simple-fixes-v3.js', 'simple-location-v4.js']) {
    const code = read('simple/' + name);
    assert.doesNotMatch(code, /kjoixhzaxopdbmudzfsg|sb_publishable_G9dKTg3ev1183qjfVkqMXg_kp5WDPaq/, name);
    assert.match(code, /window\.M_COMMERCE_SUPABASE_(?:URL|KEY)/, name);
  }
});

test('the environment initializes before client creation, without production runtime config.js', () => {
  const html = read('simple/index.html');
  assert.ok(html.indexOf('/simple/simple-official-origin.js') < html.indexOf('/simple/simple-bootstrap.js'));
  assert.ok(html.indexOf('/simple/simple-bootstrap.js') < html.indexOf('/simple/simple.js'));
  assert.doesNotMatch(html, /src=["']\/config\.js/, 'Simple must not load production j3-runtime config.js on staging');
});


test('public storefront URLs never share deprecated domains or transient preview hosts', () => {
  const js = read('simple/simple.js');
  assert.doesNotMatch(js, /m-commerce-ar\.vercel\.app\/tienda\//);
  assert.doesNotMatch(js, /const url=location\.origin\+"\/tienda\//);
  assert.match(js, /const url=window\.M_COMMERCE_OFFICIAL_ORIGIN\+"\/tienda\/"\+encodeURIComponent\(slug\)/);
  assert.match(js, /window\.M_COMMERCE_OFFICIAL_ORIGIN\+"\/tienda\/"\+encodeURIComponent\(site\.slug\)/);
});


test('Simple CSP lets staging reach its own API and Storage, without opening scripts to third parties', () => {
  const config = JSON.parse(read('vercel.json'));
  const prod = 'https://kjoixhzaxopdbmudzfsg.supabase.co';
  const staging = 'https://jcgvunffeskkbgsbomgy.supabase.co';
  const expectedRoutes = ['/simple', '/simple/(.*)', '/tienda/(.*)'];
  for (const route of expectedRoutes) {
    const rule = config.headers.find(row => row.source === route);
    assert.ok(rule, 'missing security headers for ' + route);
    const csp = rule.headers.find(h => h.key.toLowerCase() === 'content-security-policy')?.value || '';
    assert.ok(csp.includes('connect-src \'self\' ' + prod + ' ' + staging), 'stage API blocked: ' + route);
    assert.ok(csp.includes('wss://jcgvunffeskkbgsbomgy.supabase.co'), 'stage websocket blocked: ' + route);
    assert.ok(csp.includes('img-src \'self\' data: ' + prod + ' ' + staging), 'stage Storage blocked: ' + route);
    assert.match(csp, /frame-ancestors 'none'/, route);
    assert.match(csp, /script-src 'self' https:\/\/cdn\.jsdelivr\.net/, route);
  }
});

test('landing does not invent a number of active customer shops', () => {
  assert.doesNotMatch(read('simple/simple.js'), /Más de 150 tiendas funcionando/);
});


test('staging bootstrap never enters the production-only PRO runtime', () => {
  const html = read('bootstrap.html');
  const check = html.indexOf('if(STAGING){');
  const runtimeFetch = html.indexOf('async function load(){');
  assert.ok(check > 0 && runtimeFetch > check, 'staging guard must execute first');
  assert.match(html, /m-commerce-staging\.vercel\.app\/simple/);
  assert.match(html, /if\(STAGING\)\{\s*const keepQuery=/);
  assert.match(html, /location\.replace\('https:\/\/m-commerce-staging\.vercel\.app\/simple'/);
});
