-- Allow M Commerce Simple stores to exist before their Mercado Pago subscription is authorized.
-- This only expands accepted states; existing PRO rows remain unchanged.

alter table public.sites
  drop constraint if exists sites_subscription_status_check;
alter table public.sites
  add constraint sites_subscription_status_check
  check (subscription_status = any (array[
    'pending'::text,'trial'::text,'active'::text,'past_due'::text,
    'paused'::text,'cancelled'::text,'buyout'::text
  ]));

alter table public.site_subscriptions
  drop constraint if exists site_subscriptions_status_check;
alter table public.site_subscriptions
  add constraint site_subscriptions_status_check
  check (status = any (array[
    'pending'::text,'trial'::text,'active'::text,'past_due'::text,
    'suspended'::text,'cancelled'::text,'buyout'::text
  ]));
