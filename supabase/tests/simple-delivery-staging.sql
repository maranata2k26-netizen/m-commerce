-- Item 9 regression, STAGING ONLY. All modified data is rolled back.
BEGIN;
SELECT set_config('mc9.owner',
 (SELECT m.user_id::text FROM public.site_memberships m
  JOIN public.sites s ON s.id=m.site_id
  JOIN public.profiles p ON p.id=m.user_id
  WHERE s.product_tier='simple' AND m.status='active' AND p.role<>'admin'
  ORDER BY s.created_at DESC LIMIT 1),true) IS NOT NULL AS owner_present;
SELECT set_config('mc9.site',
 (SELECT m.site_id::text FROM public.site_memberships m
  JOIN public.sites s ON s.id=m.site_id
  WHERE m.user_id=current_setting('mc9.owner')::uuid AND m.status='active' AND s.product_tier='simple'
  LIMIT 1),true) IS NOT NULL AS site_present;
SELECT set_config('mc9.other',
 (SELECT s.id::text FROM public.sites s
  WHERE s.product_tier='simple' AND s.id<>current_setting('mc9.site')::uuid
  LIMIT 1),true) IS NOT NULL AS other_present;
SELECT set_config('request.jwt.claim.sub',current_setting('mc9.owner'),true) IS NOT NULL AS jwt_set;
SET LOCAL ROLE authenticated;
DO $test$
DECLARE
  v_site uuid:=current_setting('mc9.site')::uuid;
  v_other uuid:=current_setting('mc9.other')::uuid;
  v_version timestamptz;
  v_result jsonb;
BEGIN
  IF public.platform_is_site_member(v_other) THEN RAISE EXCEPTION 'MEMBER_OF_OTHER_STORE'; END IF;
  IF has_function_privilege('anon',
    'public.simple_update_delivery_settings(uuid,jsonb,timestamptz)','EXECUTE')
    THEN RAISE EXCEPTION 'ANON_CAN_MODIFY_DELIVERY'; END IF;
  SELECT updated_at INTO v_version FROM public.settings WHERE site_id=v_site;
  IF v_version IS NULL THEN RAISE EXCEPTION 'SETTINGS_NOT_FOUND'; END IF;

  -- Invalid merchant data must be rejected before any write.
  BEGIN
    PERFORM public.simple_update_delivery_settings(v_site,
      '{"pickup_enabled":false,"shipping_enabled":false,"delivery_fee":0,"delivery_info":""}'::jsonb,v_version);
    RAISE EXCEPTION 'INVALID_METHODS_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'DELIVERY_METHOD_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.simple_update_delivery_settings(v_site,
      '{"pickup_enabled":true,"shipping_enabled":true,"delivery_fee":-2,"delivery_info":""}'::jsonb,v_version);
    RAISE EXCEPTION 'NEGATIVE_FEE_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'INVALID_DELIVERY_FEE' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.simple_update_delivery_settings(v_other,
      '{"pickup_enabled":true,"shipping_enabled":true,"delivery_fee":1,"delivery_info":""}'::jsonb,v_version);
    RAISE EXCEPTION 'FOREIGN_SITE_EDITED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'SITE_ACCESS_DENIED' THEN RAISE; END IF;
  END;

  v_result:=public.simple_update_delivery_settings(v_site,
    '{"pickup_enabled":true,"shipping_enabled":true,"delivery_fee":50.25,"delivery_info":"Cobertura de prueba"}'::jsonb,v_version);
  IF (v_result->>'delivery_fee')::numeric <> 50.25 THEN RAISE EXCEPTION 'WRONG_FEE'; END IF;
  IF (v_result->>'delivery_info') <> 'Cobertura de prueba' THEN RAISE EXCEPTION 'WRONG_INFO'; END IF;
  IF (SELECT delivery_fee FROM public.settings WHERE site_id=v_site) <> 50.25
    THEN RAISE EXCEPTION 'BACKEND_FEE_MISMATCH'; END IF;

  BEGIN
    PERFORM public.simple_update_delivery_settings(v_site,
      '{"pickup_enabled":true,"shipping_enabled":true,"delivery_fee":99,"delivery_info":"Obsoleto"}'::jsonb,v_version);
    RAISE EXCEPTION 'STALE_WRITE_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'DELIVERY_SETTINGS_CHANGED_RELOAD' THEN RAISE; END IF;
  END;
END $test$;
ROLLBACK;
