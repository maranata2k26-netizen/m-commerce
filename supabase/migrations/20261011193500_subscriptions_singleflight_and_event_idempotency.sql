-- M Commerce staging: make subscription creation single-flight per site
-- and prevent duplicate lifecycle audit events on repeated provider notifications.
ALTER TABLE public.site_subscriptions
  ADD COLUMN IF NOT EXISTS provider_creation_attempt_id uuid,
  ADD COLUMN IF NOT EXISTS provider_creation_claimed_at timestamptz;

CREATE OR REPLACE FUNCTION public.platform_claim_subscription_attempt(p_site_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_attempt uuid;
BEGIN
  UPDATE public.site_subscriptions AS s
     SET provider_creation_attempt_id = coalesce(s.provider_creation_attempt_id, gen_random_uuid()),
         provider_creation_claimed_at = clock_timestamp()
   WHERE s.site_id = p_site_id
     AND (s.provider_creation_claimed_at IS NULL
          OR s.provider_creation_claimed_at < clock_timestamp() - interval '5 minutes')
  RETURNING s.provider_creation_attempt_id INTO v_attempt;
  RETURN v_attempt;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_claim_subscription_attempt(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_claim_subscription_attempt(uuid) TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS subscription_events_mp_payment_once_idx
  ON public.subscription_events (site_id,event_type,provider,provider_reference)
  WHERE provider = 'mercadopago'
    AND provider_reference IS NOT NULL
    AND event_type IN ('automatic_payment_approved','automatic_payment_reversed','automatic_payment_failed');
