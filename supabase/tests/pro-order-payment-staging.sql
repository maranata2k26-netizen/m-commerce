-- Staging-only database contracts. Provider states below are fixtures, not real MP payments.
BEGIN;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM mcommerce_staging_control.environment WHERE project_id='jcgvunffeskkbgsbomgy') THEN RAISE EXCEPTION 'STAGING_REQUIRED'; END IF; END $guard$;
CREATE TEMP TABLE pro_test_ids(kind text primary key,id uuid);
GRANT SELECT,INSERT ON pro_test_ids TO authenticated,service_role;
INSERT INTO auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES('a0281028-0001-4001-8001-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pro-payments-regression@example.invalid',now(),'{"provider":"email","providers":["email"]}','{"full_name":"PRO rollback fixture"}',now(),now());
SELECT set_config('request.jwt.claim.sub','a0281028-0001-4001-8001-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"a0281028-0001-4001-8001-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO pro_test_ids VALUES('site',(public.simple_create_store('PRO rollback fixture','qa-pro-rollback-20261028')->>'id')::uuid);
INSERT INTO pro_test_ids VALUES('product',(public.simple_upsert_product((SELECT id FROM pro_test_ids WHERE kind='site'),'{"name":"QA PRO product","price":123.45,"active":true,"stock_tracking":true,"stock_quantity":10}'::jsonb)->>'id')::uuid);
RESET ROLE;
-- Use PRO tier for every checkout/payment assertion. No persistent shop is changed.
UPDATE public.sites SET product_tier='pro',status='published',subscription_status='active',order_control_mode='manual',accepting_orders=true WHERE id=(SELECT id FROM pro_test_ids WHERE kind='site');
UPDATE public.settings SET payment_methods='{"cash":true,"mercadopago":true}',fulfillment_config='{"pickup_enabled":true,"shipping_enabled":false}' WHERE site_id=(SELECT id FROM pro_test_ids WHERE kind='site');
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
DO $test$
DECLARE sid uuid:=(SELECT id FROM pro_test_ids WHERE kind='site'); pid uuid:=(SELECT id FROM pro_test_ids WHERE kind='product'); r jsonb; replay jsonb; oid uuid; approved_id uuid; items jsonb; stock integer; n integer:=0;
BEGIN
 items:=jsonb_build_array(jsonb_build_object('product_id',pid,'quantity',2));
 r:=public.create_checkout_order_v117('QA PRO','541100000001','qa-pro@example.invalid','','pickup','rollback fixture','mercadopago',sid,items,'a0281028-1001-4001-8001-000000000001');
 oid:=(r->>'id')::uuid;
 IF (r->>'total')::numeric<>246.90 THEN RAISE EXCEPTION 'PRO_CENTS_LOST'; END IF;n:=n+1;
 SELECT stock_quantity INTO stock FROM public.products WHERE id=pid;IF stock<>8 THEN RAISE EXCEPTION 'PRO_STOCK_NOT_RESERVED'; END IF;n:=n+1;
 replay:=public.create_checkout_order_v117('QA PRO','541100000001','qa-pro@example.invalid','','pickup','rollback fixture','mercadopago',sid,items,'a0281028-1001-4001-8001-000000000001');
 IF replay->>'id'<>r->>'id' OR NOT (replay->>'idempotent_replay')::boolean THEN RAISE EXCEPTION 'PRO_CHECKOUT_REPLAY_DUPLICATED'; END IF;n:=n+1;
 SELECT stock_quantity INTO stock FROM public.products WHERE id=pid;IF stock<>8 THEN RAISE EXCEPTION 'PRO_REPLAY_DOUBLE_STOCK'; END IF;n:=n+1;
 PERFORM public.platform_apply_order_payment(sid,oid,'rejected','qa fixture','928100001');
 IF NOT EXISTS(SELECT 1 FROM orders WHERE id=oid AND payment_status='rejected' AND status='cancelled' AND stock_restored) THEN RAISE EXCEPTION 'PRO_REJECT_STATE'; END IF;n:=n+1;
 SELECT stock_quantity INTO stock FROM public.products WHERE id=pid;IF stock<>10 THEN RAISE EXCEPTION 'PRO_REJECT_STOCK'; END IF;n:=n+1;
 PERFORM public.platform_apply_order_payment(sid,oid,'rejected','qa replay','928100001');
 SELECT stock_quantity INTO stock FROM public.products WHERE id=pid;IF stock<>10 THEN RAISE EXCEPTION 'PRO_REJECT_REPLAY_STOCK'; END IF;n:=n+1;
 items:=jsonb_build_array(jsonb_build_object('product_id',pid,'quantity',1));
 r:=public.create_checkout_order_v117('QA PRO','541100000001','qa-pro@example.invalid','','pickup','rollback fixture','mercadopago',sid,items,'a0281028-1002-4001-8001-000000000001');
 approved_id:=(r->>'id')::uuid;
 PERFORM public.platform_apply_order_payment(sid,approved_id,'approved','qa fixture','928100002');
 IF NOT EXISTS(SELECT 1 FROM orders WHERE id=approved_id AND payment_status='approved' AND status='paid' AND paid_at IS NOT NULL) THEN RAISE EXCEPTION 'PRO_APPROVAL_STATE'; END IF;n:=n+1;
 replay:=public.platform_apply_order_payment(sid,approved_id,'approved','qa replay','928100002');
 IF replay->>'notify_merchant'<>'false' THEN RAISE EXCEPTION 'PRO_APPROVAL_DUPLICATE_NOTIFICATION'; END IF;n:=n+1;
 PERFORM public.platform_apply_order_payment(sid,approved_id,'rejected','qa stale','928100002');
 IF NOT EXISTS(SELECT 1 FROM orders WHERE id=approved_id AND payment_status='approved' AND status='paid') THEN RAISE EXCEPTION 'PRO_STALE_REJECTION'; END IF;n:=n+1;
 SELECT stock_quantity INTO stock FROM public.products WHERE id=pid;IF stock<>9 THEN RAISE EXCEPTION 'PRO_PAID_STOCK_CHANGED'; END IF;n:=n+1;
 PERFORM public.platform_apply_order_payment(sid,approved_id,'refunded','qa fixture','928100002');
 PERFORM public.platform_apply_order_payment(sid,approved_id,'approved','qa stale','928100002');
 IF NOT EXISTS(SELECT 1 FROM orders WHERE id=approved_id AND payment_status='refunded') THEN RAISE EXCEPTION 'PRO_REFUND_DOWNGRADED'; END IF;n:=n+1;
 replay:=public.simple_reconcile_subscription_entitlement(sid,'QA_NOT_A_SIMPLE_SUBSCRIPTION');
 IF replay->>'applicable'<>'false' OR NOT EXISTS(SELECT 1 FROM sites WHERE id=sid AND subscription_status='active' AND product_tier='pro') THEN RAISE EXCEPTION 'SIMPLE_RECONCILER_CHANGED_PRO'; END IF;n:=n+1;
 r:=public.create_checkout_order_v117('QA PRO cash','541100000002','qa-pro-cash@example.invalid','','pickup','rollback fixture','cash',sid,items,'a0281028-1003-4001-8001-000000000001');
 IF (r->>'total')::numeric<>123.45 OR NOT EXISTS(SELECT 1 FROM orders WHERE id=(r->>'id')::uuid AND payment_method='cash' AND status='new') THEN RAISE EXCEPTION 'PRO_CASH_REGRESSION'; END IF;n:=n+1;
 SELECT stock_quantity INTO stock FROM public.products WHERE id=pid;IF stock<>8 THEN RAISE EXCEPTION 'PRO_CASH_STOCK'; END IF;n:=n+1;
 IF n<>15 THEN RAISE EXCEPTION 'INCOMPLETE_PRO_REGRESSION'; END IF;
END $test$;
RESET ROLE;
ROLLBACK;
SELECT 15 AS pro_database_payment_checks_passed,'fixtures_rolled_back' AS outcome;
