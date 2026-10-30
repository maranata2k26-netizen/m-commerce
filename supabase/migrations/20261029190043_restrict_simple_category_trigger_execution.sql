-- This function is an internal row trigger, not an RPC contract.
-- PostgreSQL invokes attached triggers independently of client EXECUTE grants.
REVOKE EXECUTE ON FUNCTION public.simple_order_category_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simple_order_category_guard() TO service_role;
