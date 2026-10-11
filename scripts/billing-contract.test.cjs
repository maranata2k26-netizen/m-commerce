'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const fn = name => fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', name, 'index.ts'), 'utf8');
const staging = 'https://m-commerce-staging.vercel.app';

test('payment endpoints exist as tracked source files', () => {
  for (const name of ['j3-billing', 'j3-billing-account', 'j3-billing-webhook',
    'mercadopago-connect', 'mercadopago-webhook', 'checkout-create', 'simple-checkout']) {
    assert.ok(fn(name).length > 1000, name);
  }
});

test('staging billing, OAuth and checkout all keep their returns on staging', () => {
  for (const name of ['j3-billing', 'j3-billing-account', 'mercadopago-connect',
    'checkout-create', 'platform-admin', 'simple-checkout']) {
    assert.ok(fn(name).includes(staging), name);
  }
});

test('merchant and subscription funds use distinct account records', () => {
  assert.match(fn('j3-billing'), /from\(['"]platform_billing_accounts['"]\)/);
  assert.match(fn('j3-billing-account'), /from\(['"]platform_billing_accounts['"]\)/);
  assert.match(fn('checkout-create'), /from\(['"]mercadopago_connections['"]\)/);
  assert.match(fn('mercadopago-connect'), /from\(["']mercadopago_connections["']\)/);
  assert.match(fn('mercadopago-connect'), /from\(["']platform_billing_accounts["']\)/);
});

test('platform billing confirmation checks recipient identity and merchant conflicts', () => {
  const code = fn('j3-billing-account');
  assert.match(code, /ACCOUNT_EMAIL_MISMATCH/);
  assert.match(code, /MP_ACCOUNT_ALREADY_USED/);
  assert.match(code, /ADMIN_REQUIRED/);
  assert.match(code, /expected_email/);
  assert.match(fn('mercadopago-connect'), /billingUsage/);
});

test('subscription payment webhooks fail closed without a valid signature', () => {
  const code = fn('j3-billing-webhook');
  assert.match(code, /WEBHOOK_SECRET_NOT_CONFIGURED/);
  assert.match(code, /INVALID_SIGNATURE/);
  assert.match(code, /validSignature\(req,dataId\)/);
  assert.match(code, /SUBSCRIPTION_CURRENCY_MISMATCH/);
  assert.match(code, /provider_subscription_id/);
  assert.match(code, /ps==='pending'\?'pending'/);
});

test('staging checkout cannot silently bill the legacy Maranata merchant for a missing store id', () => {
  assert.match(fn('checkout-create'), /IS_STAGING\?'':LEGACY_SITE_ID/);
});

test('edge code does not embed credentials or production service-role JWTs', () => {
  for (const name of ['j3-billing', 'j3-billing-account', 'j3-billing-webhook',
    'mercadopago-connect', 'checkout-create', 'platform-admin', 'simple-checkout']) {
    const code = fn(name);
    assert.doesNotMatch(code, /sb_secret_[a-zA-Z0-9_-]{20,}/, name);
    assert.doesNotMatch(code, /eyJhbGciOiJ[A-Za-z0-9_-]{100,}/, name);
  }
});


test('platform billing refuses a connected merchant account before requesting a subscription', () => {
  const source = fn('j3-billing');
  const collector = source.split('async function collectorToken')[1]?.split('async function syncPreapproval')[0] || '';
  assert.match(collector, /J3_BILLING_IDENTITY_NOT_CONFIRMED/);
  assert.match(collector, /confirmed_at/);
  assert.match(collector, /account_email/);
  assert.match(collector, /expected_email/);
  assert.match(collector, /from\('mercadopago_connections'\)/);
  assert.match(collector, /eq\('mp_user_id',String\(a\.mp_user_id\)\)/);
  assert.match(collector, /eq\('status','connected'\)/);
  assert.match(collector, /MP_ACCOUNT_ALREADY_USED/);
});

test('platform OAuth callback refuses connected merchant identity before saving billing account', () => {
  const src = fn('mercadopago-connect');
  const platformFlow = src.split('if(callbackFlow==="platform_billing"){')[1]?.split('if(!await canManageMerchant')[0] || '';
  assert.match(platformFlow, /from\("mercadopago_connections"\)/);
  assert.match(platformFlow, /merchantUsage\.data/);
  assert.match(platformFlow, /account_in_use/);
  assert.ok(platformFlow.indexOf('merchantUsage.data') < platformFlow.indexOf('.upsert({provider:"mercadopago"'));
});

test('subscription webhook checks collector identity and merchant collision before applying a payment', () => {
  const src = fn('j3-billing-webhook');
  const account = src.split('async function account')[1]?.split('async function token')[0] || '';
  assert.match(account, /J3_BILLING_IDENTITY_NOT_CONFIRMED/);
  assert.match(account, /from\('mercadopago_connections'\)/);
  assert.match(account, /MP_ACCOUNT_ALREADY_USED/);
});

test('admin billing account status reports existing identity collision rather than claiming ready', () => {
  const src = fn('j3-billing-account');
  const statusFlow = src.split('if(action==="account_status")')[1]?.split('if(action==="account_start")')[0] || '';
  assert.match(statusFlow, /account_conflict:conflict/);
  assert.match(statusFlow, /connected:a\.status==="connected"&&!conflict/);
});

test('staging checkout cannot use legacy merchant token even if legacy site id is supplied', () => {
  const src = fn('checkout-create');
  assert.match(src, /if\(!IS_STAGING&&siteId===LEGACY_SITE_ID&&LEGACY_MP_TOKEN\)/);
});
