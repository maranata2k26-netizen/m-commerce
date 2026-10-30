-- Applied only to Supabase staging (jcgvunffeskkbgsbomgy) on 2026-10-11.
-- Production requires a separately authorized, validated release.
ALTER TABLE public.platform_billing_accounts
ADD COLUMN IF NOT EXISTS allowed_shared_merchant_site_id uuid
REFERENCES public.sites(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.platform_billing_accounts.allowed_shared_merchant_site_id
IS 'Explicit admin-approved merchant site allowed to share this verified Mercado Pago collector for platform subscriptions; null denies sharing.';
