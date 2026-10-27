BEGIN;
DO $test$
DECLARE signature text; fn regprocedure;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.hardware_category_admin_summary(uuid)',
    'public.hardware_delete_category(uuid,uuid)',
    'public.hardware_move_category(uuid,uuid,text)',
    'public.platform_create_site_v178(text,text,text,text,text)',
    'public.platform_push_subscription_state(uuid)',
    'public.platform_remove_push_subscription(uuid,text)',
    'public.platform_save_push_subscription(uuid,jsonb)'
  ] LOOP
    fn := to_regprocedure(signature);
    IF fn IS NULL OR has_function_privilege('anon',fn,'EXECUTE')
      OR NOT has_function_privilege('authenticated',fn,'EXECUTE')
      OR NOT has_function_privilege('service_role',fn,'EXECUTE') THEN
      RAISE EXCEPTION 'RPC_PRIVILEGE_REGRESSION: %',signature;
    END IF;
  END LOOP;
  FOREACH signature IN ARRAY ARRAY[
    'public.platform_order_growth_trigger()',
    'public.platform_prevent_master_membership()',
    'public.platform_prevent_member_promotion()'
  ] LOOP
    fn := to_regprocedure(signature);
    IF fn IS NULL OR has_function_privilege('anon',fn,'EXECUTE')
      OR has_function_privilege('authenticated',fn,'EXECUTE')
      OR NOT has_function_privilege('service_role',fn,'EXECUTE') THEN
      RAISE EXCEPTION 'TRIGGER_PRIVILEGE_REGRESSION: %',signature;
    END IF;
  END LOOP;
END $test$;
SET LOCAL ROLE anon;
DO $test$
BEGIN
  BEGIN
    PERFORM public.hardware_category_admin_summary('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid);
    RAISE EXCEPTION 'ANONYMOUS_ADMIN_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.platform_create_site_v178('QA denied','qa-denied','AR','retail',null);
    RAISE EXCEPTION 'ANONYMOUS_CREATE_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF public.simple_public_plan() IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_PLAN_REGRESSION';
  END IF;
END $test$;
RESET ROLE;
SELECT 'internal RPC privileges and public plan verified' AS result;
ROLLBACK;
