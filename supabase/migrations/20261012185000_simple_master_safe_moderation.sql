-- Item 8: Maestro Simple — admin-only billing overview and race-safe store moderation.
-- Applied solely to Supabase STAGING after review. Do not deploy to production.
-- Never surface provider credentials, payment tokens, or private payer details.

CREATE OR REPLACE FUNCTION public.simple_master_stores()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_result jsonb;
BEGIN
  IF NOT public.platform_is_master_admin() THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'name',s.name,'slug',s.slug,'owner_id',s.owner_id,
    'owner_email',u.email,'created_at',s.created_at,'status',s.status,
    'subscription_status',s.subscription_status,'is_suspended',s.is_suspended,
    'last_activity_at',s.last_activity_at,
    'products',(SELECT count(*) FROM public.products p WHERE p.site_id=s.id),
    'orders',(SELECT count(*) FROM public.orders o WHERE o.site_id=s.id),
    'subscription', CASE WHEN ss.site_id IS NULL THEN NULL ELSE jsonb_build_object(
      'status',ss.status,'billing_mode',ss.billing_mode,
      'provider',ss.provider,'provider_status',ss.provider_status,
      'next_due_at',ss.next_due_at,'grace_until',ss.grace_until,
      'last_paid_at',ss.last_paid_at,
      'plan_name',pl.name,'plan_code',pl.code,
      'currency_code',pl.currency_code,
      'monthly_amount',coalesce(ss.amount_override,pl.monthly_price)
    ) END
  ) ORDER BY s.created_at DESC),'[]'::jsonb)
  INTO v_result
  FROM public.sites s
  LEFT JOIN auth.users u ON u.id=s.owner_id
  LEFT JOIN public.site_subscriptions ss ON ss.site_id=s.id
  LEFT JOIN public.subscription_plans pl ON pl.id=ss.plan_id
  WHERE s.product_tier='simple';
  RETURN v_result;
END;
$fn$;

-- Concurrent admins cannot silently overwrite another admin's decision.
-- The older simple_admin_set_store_state RPC remains untouched for backwards compatibility.
CREATE OR REPLACE FUNCTION public.simple_admin_set_store_state_safe(
  p_site_id uuid, p_action text, p_expected_suspended boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_site public.sites;
BEGIN
  IF NOT public.platform_is_master_admin() THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
  IF p_action NOT IN ('suspend','reactivate') THEN RAISE EXCEPTION 'INVALID_ACTION'; END IF;
  IF p_expected_suspended IS NULL THEN RAISE EXCEPTION 'EXPECTED_STATE_REQUIRED'; END IF;

  SELECT * INTO v_site
  FROM public.sites
  WHERE id=p_site_id AND product_tier='simple'
  FOR UPDATE;
  IF v_site.id IS NULL THEN RAISE EXCEPTION 'SIMPLE_SITE_NOT_FOUND'; END IF;
  IF coalesce(v_site.is_suspended,false) IS DISTINCT FROM p_expected_suspended
    THEN RAISE EXCEPTION 'STORE_STATE_CHANGED_RELOAD'; END IF;

  IF v_site.is_suspended = (p_action='suspend') THEN
    RETURN jsonb_build_object('id',v_site.id,'is_suspended',v_site.is_suspended,
      'status',v_site.status,'subscription_status',v_site.subscription_status,
      'unchanged',true);
  END IF;

  UPDATE public.sites SET is_suspended=(p_action='suspend'),
    updated_at=now(),last_activity_at=now()
  WHERE id=p_site_id RETURNING * INTO v_site;

  PERFORM public.platform_audit(p_site_id,
    CASE WHEN p_action='suspend' THEN 'simple_store_suspended' ELSE 'simple_store_reactivated' END,
    'site',p_site_id::text,
    jsonb_build_object('action',p_action,'expected_suspended',p_expected_suspended));

  RETURN jsonb_build_object('id',v_site.id,'is_suspended',v_site.is_suspended,
    'status',v_site.status,'subscription_status',v_site.subscription_status,
    'unchanged',false);
END;
$fn$;

REVOKE ALL ON FUNCTION public.simple_admin_set_store_state_safe(uuid,text,boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simple_admin_set_store_state_safe(uuid,text,boolean)
  TO authenticated, service_role;
