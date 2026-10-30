-- Administrative RPCs require a signed-in caller; retain their existing tenant checks.
-- Trigger functions run through triggers and have no direct client API contract.
DO $hardening$
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
    IF fn IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
    END IF;
  END LOOP;
  FOREACH signature IN ARRAY ARRAY[
    'public.platform_order_growth_trigger()',
    'public.platform_prevent_master_membership()',
    'public.platform_prevent_member_promotion()'
  ] LOOP
    fn := to_regprocedure(signature);
    IF fn IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END
$hardening$;
