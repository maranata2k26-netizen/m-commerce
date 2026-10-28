BEGIN;
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM mcommerce_staging_control.environment WHERE project_id='jcgvunffeskkbgsbomgy') THEN RAISE EXCEPTION 'STAGING_REQUIRED'; END IF;
END $guard$;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM auth.users WHERE email='qa-final-a@mc-stage.example.invalid'),true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('request.jwt.claim.sub'),'role','authenticated')::text,true);
SELECT set_config('mc_review.other_site',(SELECT s.id::text FROM public.sites s WHERE EXISTS(SELECT 1 FROM public.site_memberships mb JOIN auth.users ub ON ub.id=mb.user_id WHERE mb.site_id=s.id AND ub.email='qa-final-b@mc-stage.example.invalid') AND NOT EXISTS(SELECT 1 FROM public.site_memberships m WHERE m.site_id=s.id AND m.user_id=current_setting('request.jwt.claim.sub')::uuid AND m.status='active')),true);
DO $guard$ BEGIN IF nullif(current_setting('request.jwt.claim.sub',true),'') IS NULL OR nullif(current_setting('mc_review.other_site',true),'') IS NULL THEN RAISE EXCEPTION 'QA_FIXTURE_MISSING'; END IF; END $guard$;
SET LOCAL ROLE authenticated;
DO $test$
DECLARE name text; result jsonb; checked integer:=0;
BEGIN
 FOREACH name IN ARRAY ARRAY[
 'hardware_category_admin_summary','hardware_publish_design',
 'platform_commerce_diagnostics','platform_domain_overview','platform_get_catalog',
 'platform_get_editor_bundle','platform_get_merchant_branding','platform_list_design_presets_editor',
 'platform_master_preview_site','platform_payment_connection_status','platform_push_subscription_state',
 'platform_seller_configuration','platform_sports_activity_sections','platform_sports_admin_courts',
 'platform_subscription_state','platform_terms_status','simple_complete_onboarding',
 'simple_dashboard','simple_design_presets','simple_mercadopago_status',
 'simple_operations_summary','simple_publish_store'
 ] LOOP
  BEGIN
   EXECUTE format('SELECT public.%I(%L::uuid)',name,current_setting('mc_review.other_site')) INTO result;
   RAISE EXCEPTION 'CROSS_TENANT_CALL_RETURNED: %',name;
  EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT SIMILAR TO '%(SITE_ACCESS_DENIED|ACCESS_DENIED|ADMIN_REQUIRED|OWNER_REQUIRED|AUTH_REQUIRED|SITE_MEMBER_REQUIRED|NOT_SITE_MEMBER)%' THEN RAISE EXCEPTION 'UNEXPECTED_RESULT %: %',name,SQLERRM; END IF;
  END;
  checked:=checked+1;
 END LOOP;
 RAISE NOTICE 'cross_tenant_admin_rpcs_denied=%',checked;
END $test$;
RESET ROLE;
SELECT 22 AS cross_tenant_admin_rpcs_denied,'rolled_back' AS outcome;
ROLLBACK;
