-- Simple only. Recompute entitlement from verified payment events in one transaction.
-- Never lift a moderation suspension, and never change PRO subscription behavior.
CREATE OR REPLACE FUNCTION public.simple_reconcile_subscription_entitlement(p_site_id uuid,p_subscription_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE sub public.site_subscriptions; last_valid timestamptz; effective text; adverse boolean;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.sites WHERE id=p_site_id AND product_tier='simple') THEN
  RETURN jsonb_build_object('applicable',false);
 END IF;
 SELECT * INTO sub FROM public.site_subscriptions WHERE site_id=p_site_id
  AND provider='mercadopago' AND provider_subscription_id=p_subscription_id FOR UPDATE;
 IF sub.site_id IS NULL THEN RAISE EXCEPTION 'SUBSCRIPTION_BINDING_MISMATCH'; END IF;
 SELECT max(e.paid_at) INTO last_valid FROM public.subscription_payment_events e
 WHERE e.site_id=p_site_id AND e.provider='mercadopago' AND e.provider_subscription_id=p_subscription_id
  AND e.provider_status='approved' AND e.paid_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.subscription_payment_events r
   WHERE r.site_id=e.site_id AND r.provider=e.provider AND r.provider_payment_id=e.provider_payment_id
    AND r.provider_status IN ('refunded','charged_back'));
 SELECT EXISTS(SELECT 1 FROM public.subscription_payment_events e WHERE e.site_id=p_site_id
  AND e.provider='mercadopago' AND e.provider_subscription_id=p_subscription_id
  AND e.provider_status IN ('refunded','charged_back','rejected','cancelled')) INTO adverse;
 effective:=CASE
  WHEN sub.provider_status IN ('cancelled','canceled') THEN 'cancelled'
  WHEN sub.provider_status='paused' THEN 'past_due'
  WHEN last_valid IS NOT NULL AND (sub.next_due_at IS NULL OR sub.next_due_at>now() OR sub.grace_until>now()) THEN 'active'
  WHEN last_valid IS NOT NULL OR adverse THEN 'past_due'
  ELSE 'pending' END;
 UPDATE public.site_subscriptions SET status=effective,last_paid_at=last_valid,updated_at=now() WHERE site_id=p_site_id;
 UPDATE public.sites SET subscription_status=effective,updated_at=now() WHERE id=p_site_id;
 RETURN jsonb_build_object('applicable',true,'status',effective,'last_paid_at',last_valid);
END;$fn$;
REVOKE ALL ON FUNCTION public.simple_reconcile_subscription_entitlement(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simple_reconcile_subscription_entitlement(uuid,text) TO service_role;
