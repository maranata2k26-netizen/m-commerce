-- M Commerce Simple item 7: tenant isolation regression (STAGING ONLY).
-- READ-ONLY business operations; all session changes are LOCAL and rolled back.
-- Requires one active non-admin simple merchant and a second Simple site.
BEGIN;
SELECT set_config('mc_test.user_id',
  (SELECT m.user_id::text FROM public.site_memberships m
   JOIN public.sites s ON s.id=m.site_id
   JOIN public.profiles p ON p.id=m.user_id
   WHERE s.product_tier='simple' AND m.status='active' AND p.role<>'admin'
   ORDER BY m.created_at LIMIT 1),true) IS NOT NULL AS fixture_user_found;
SELECT set_config('mc_test.owned_site',
  (SELECT m.site_id::text FROM public.site_memberships m JOIN public.sites s ON s.id=m.site_id
   WHERE m.user_id=current_setting('mc_test.user_id',true)::uuid
     AND s.product_tier='simple' AND m.status='active' LIMIT 1),true) IS NOT NULL AS owned_site_found;
SELECT set_config('mc_test.other_site',
  (SELECT s.id::text FROM public.sites s
   WHERE s.product_tier='simple' AND s.id<>current_setting('mc_test.owned_site',true)::uuid LIMIT 1),true) IS NOT NULL AS other_site_found;
SELECT set_config('mc_test.other_slug',
  (SELECT s.slug FROM public.sites s WHERE s.id=current_setting('mc_test.other_site',true)::uuid),true) IS NOT NULL AS other_slug_found;
SELECT set_config('request.jwt.claim.sub',current_setting('mc_test.user_id',true),true) IS NOT NULL AS jwt_initialized;
SET LOCAL ROLE authenticated;
DO $test$
DECLARE v_owned uuid:=current_setting('mc_test.owned_site')::uuid;
        v_foreign uuid:=current_setting('mc_test.other_site')::uuid;
        v_slug text:=current_setting('mc_test.other_slug');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'SECURITY_TEST_NO_AUTH'; END IF;
  IF NOT public.platform_is_site_member(v_owned)
    OR public.platform_is_site_member(v_foreign) THEN
    RAISE EXCEPTION 'SECURITY_TEST_MEMBERSHIP_LEAK';
  END IF;
  IF (SELECT count(*) FROM public.sites WHERE product_tier='simple')<>1 THEN
    RAISE EXCEPTION 'SECURITY_TEST_SITE_VISIBILITY';
  END IF;
  IF EXISTS (SELECT 1 FROM public.products WHERE site_id=v_foreign)
    OR EXISTS (SELECT 1 FROM public.product_categories WHERE site_id=v_foreign)
    OR EXISTS (SELECT 1 FROM public.product_variants WHERE site_id=v_foreign)
    OR EXISTS (SELECT 1 FROM public.orders WHERE site_id=v_foreign)
    OR EXISTS (SELECT 1 FROM public.order_items WHERE site_id=v_foreign) THEN
    RAISE EXCEPTION 'SECURITY_TEST_FOREIGN_ROWS';
  END IF;
  IF has_function_privilege('authenticated',
       'public.platform_audit(uuid,text,text,text,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'SECURITY_TEST_AUDIT_FORGERY_ENABLED';
  END IF;
  PERFORM public.simple_dashboard(v_owned);
  BEGIN
    PERFORM public.simple_preview_storefront(v_slug);
    RAISE EXCEPTION 'SECURITY_TEST_FOREIGN_PREVIEW_EXPOSED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'SITE_ACCESS_DENIED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.simple_dashboard(v_foreign);
    RAISE EXCEPTION 'SECURITY_TEST_FOREIGN_DASHBOARD_EXPOSED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'SITE_ACCESS_DENIED' THEN RAISE; END IF;
  END;
END
$test$;
ROLLBACK;
