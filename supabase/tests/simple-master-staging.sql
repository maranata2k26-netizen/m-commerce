-- Item 8 staging permission check: read-only guards, never creates users or makes payments.
BEGIN;
SELECT set_config('request.jwt.claim.sub',
 (SELECT m.user_id::text FROM public.site_memberships m
  JOIN public.sites s ON s.id=m.site_id
  WHERE m.status='active' AND s.product_tier='simple' LIMIT 1), true) IS NOT NULL AS merchant_fixture;
SET LOCAL ROLE authenticated;
DO $test$
BEGIN
 IF public.platform_is_master_admin() THEN
   RAISE EXCEPTION 'MERCHANT_IS_MASTER';
 END IF;
 BEGIN
   PERFORM public.simple_master_stores();
   RAISE EXCEPTION 'MASTER_STORES_EXPOSED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM<>'ADMIN_REQUIRED' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM public.simple_master_pro_leads();
   RAISE EXCEPTION 'MASTER_LEADS_EXPOSED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM<>'ADMIN_REQUIRED' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM public.simple_admin_set_store_state_safe(
       '00000000-0000-4000-8000-000000000001'::uuid,'suspend',false);
   RAISE EXCEPTION 'MASTER_MODERATION_EXPOSED';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM<>'ADMIN_REQUIRED' THEN RAISE; END IF;
 END;
 IF has_function_privilege('anon',
   'public.simple_admin_set_store_state_safe(uuid,text,boolean)','EXECUTE')
 THEN RAISE EXCEPTION 'ANON_HAS_ADMIN_EXECUTE'; END IF;
END
$test$;
ROLLBACK;
