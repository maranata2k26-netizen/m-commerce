'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const base = String(process.env.MC_STAGING_BASE_URL || 'https://m-commerce-staging.vercel.app').replace(/\/+$/, '');
const productionProject = 'kjoixhzaxopdbmudzfsg';
const stagingProject = 'jcgvunffeskkbgsbomgy';

async function get(path) {
  const response = await fetch(base + path, {
    redirect: 'manual',
    headers: { 'cache-control': 'no-cache' },
    signal: AbortSignal.timeout(15000)
  });
  const body = await response.text();
  assert.equal(response.status, 200, path + ': unexpected HTTP status ' + response.status);
  return { response, body };
}

test('staging homepage and auth routes return the Simple application', async () => {
  for (const path of ['/simple', '/simple/app', '/tienda/mc-validation-route']) {
    const { body } = await get(path);
    assert.match(body, /<title>M Commerce/i, path);
    assert.match(body, /\/simple\/simple-official-origin\.js/, path);
    assert.doesNotMatch(body, /src=["']\/config\.js/, path + ' loads production runtime');
  }
});

test('published staging environment points to staging Supabase, not production', async () => {
  const { body } = await get('/simple/simple-official-origin.js');
  assert.match(body, new RegExp(stagingProject));
  assert.match(body, /m-commerce-staging\.vercel\.app/);
  assert.match(body, /M_COMMERCE_IS_STAGING/);
  const { body: client } = await get('/simple/simple.js');
  assert.match(client, /window\.M_COMMERCE_SUPABASE_URL/);
  assert.doesNotMatch(client, new RegExp(productionProject), 'browser client embeds production endpoint');
});

test('live staging CSP allows its own API and Storage on every Simple route', async () => {
  for (const path of ['/simple', '/simple/app', '/tienda/mc-validation-route']) {
    const { response } = await get(path);
    const csp = response.headers.get('content-security-policy') || '';
    assert.match(csp, new RegExp('connect-src[^;]*' + stagingProject), path + ' lacks staging API permission');
    assert.match(csp, new RegExp('img-src[^;]*' + stagingProject), path + ' lacks staging Storage permission');
    assert.match(csp, /frame-ancestors 'none'/, path + ' missing frame protection');
  }
});
