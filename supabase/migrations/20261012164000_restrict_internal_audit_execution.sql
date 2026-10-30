-- Item 7: protect integrity of audit events without changing business RPC behavior.
-- All application operations that call platform_audit are SECURITY DEFINER and
-- execute as their trusted database owner. Direct RPC calls by merchants are
-- not necessary and permit arbitrary forged audit events for their own site.
-- Keep service_role access for backend operations; production is NOT changed.
REVOKE EXECUTE ON FUNCTION public.platform_audit(uuid,text,text,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_audit(uuid,text,text,text,jsonb)
  TO service_role;
