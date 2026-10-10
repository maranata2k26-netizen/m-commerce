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
