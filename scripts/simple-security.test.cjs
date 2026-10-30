'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261012164000_restrict_internal_audit_execution.sql'),'utf8');
const sql=fs.readFileSync(path.join(root,'supabase/tests/simple-security-staging.sql'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/validate-simple.yml'),'utf8');
const src=fs.readFileSync(path.join(root,'simple/simple.js'),'utf8');

test('internal audit API is not directly callable by merchants, but service backend retains access',()=>{
 assert.match(migration,/REVOKE EXECUTE ON FUNCTION public\.platform_audit\(uuid,text,text,text,jsonb\)/);
 assert.match(migration,/FROM PUBLIC, anon, authenticated/);
 assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.platform_audit\(uuid,text,text,text,jsonb\)[\s\S]+TO service_role/);
 assert.doesNotMatch(migration,/DROP FUNCTION|CREATE OR REPLACE FUNCTION/i);
});

test('cross-tenant database regression is transactionally rolled back and detects missing permissions',()=>{
 assert.match(sql,/^BEGIN;/m);
 assert.match(sql,/^ROLLBACK;/m);
 for(const expected of ['platform_is_site_member(v_foreign)','SECURITY_TEST_SITE_VISIBILITY',
   'SECURITY_TEST_FOREIGN_ROWS','SECURITY_TEST_AUDIT_FORGERY_ENABLED',
   'SECURITY_TEST_FOREIGN_PREVIEW_EXPOSED','SECURITY_TEST_FOREIGN_DASHBOARD_EXPOSED']){
  assert.ok(sql.includes(expected),expected);
 }
 assert.match(sql,/SET LOCAL ROLE authenticated/);
 assert.match(sql,/simple_preview_storefront\(v_slug\)/);
 assert.match(sql,/simple_dashboard\(v_foreign\)/);
});

test('existing merchant and checkout pathways are preserved, with CI running security checks',()=>{
 assert.match(src,/platform_update_order_status/);
 assert.match(src,/simple_upsert_product/);
 assert.match(workflow,/node --test scripts\/simple-security\.test\.cjs/);
 assert.match(workflow,/simple-security\.test\.cjs/);
});
