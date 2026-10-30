-- Item 4: owner-controlled draft URLs; preserve legacy auto-generated slugs.
-- Staging-first. No schema change to existing tables and no data rewrite.
CREATE OR REPLACE FUNCTION public.simple_update_draft_identity(p_site_id uuid, p_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_site public.sites;
  v_base text;
  v_slug text;
begin
  if not public.platform_is_site_member(p_site_id) then raise exception 'SITE_ACCESS_DENIED'; end if;
  select * into v_site from public.sites where id=p_site_id and product_tier='simple' for update;
  if v_site.id is null then raise exception 'SIMPLE_SITE_NOT_FOUND'; end if;
  if v_site.status <> 'draft' then return jsonb_build_object('id',v_site.id,'name',v_site.name,'slug',v_site.slug,'status',v_site.status); end if;

  v_base := public.simple_slugify(trim(coalesce(p_name,'')));
  if char_length(v_base) < 3 then v_base := 'mi-tienda'; end if;

  if coalesce((v_site.metadata->>'auto_slug')::boolean,false)
     or (not coalesce(v_site.metadata ? 'auto_slug',false) and v_site.slug like 'tienda-%') then
    v_slug := left(v_base,60);
    if exists(select 1 from public.sites s where lower(s.slug)=lower(v_slug) and s.id<>p_site_id) then
      v_slug := left(v_base,51) || '-' || substr(replace(v_site.id::text,'-',''),1,8);
    end if;
    update public.sites
    set name=left(trim(p_name),100), slug=v_slug,
        metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('auto_slug',false),
        updated_at=now()
    where id=p_site_id returning * into v_site;
  end if;

  return jsonb_build_object('id',v_site.id,'name',v_site.name,'slug',v_site.slug,'status',v_site.status);
end;
$function$
;

-- New narrow RPC: only the store owner may change the slug of a draft Simple shop.
-- Existing published URLs and merchant identities are never mutated.
CREATE OR REPLACE FUNCTION public.simple_set_draft_slug(p_site_id uuid,p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_slug text := lower(trim(coalesce(p_slug,'')));
  v_site public.sites;
  v_constraint text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF char_length(v_slug) NOT BETWEEN 3 AND 60
    OR v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  THEN RAISE EXCEPTION 'INVALID_STORE_SLUG'; END IF;

  SELECT * INTO v_site FROM public.sites
    WHERE id=p_site_id AND owner_id=v_user AND product_tier='simple'
    FOR UPDATE;
  IF v_site.id IS NULL THEN RAISE EXCEPTION 'SITE_ACCESS_DENIED'; END IF;
  IF v_site.status <> 'draft' THEN RAISE EXCEPTION 'STORE_ALREADY_PUBLISHED'; END IF;

  UPDATE public.sites
  SET slug=v_slug,
      metadata=coalesce(metadata,'{}'::jsonb)
        || '{"auto_slug":false,"slug_customized":true}'::jsonb,
      updated_at=now()
  WHERE id=p_site_id
  RETURNING * INTO v_site;

  RETURN jsonb_build_object('id',v_site.id,'slug',v_site.slug,'name',v_site.name);
EXCEPTION WHEN unique_violation THEN
  GET STACKED DIAGNOSTICS v_constraint=CONSTRAINT_NAME;
  IF v_constraint='sites_slug_lower_unique' THEN
    RAISE EXCEPTION 'SLUG_ALREADY_EXISTS';
  END IF;
  RAISE;
END;
$function$;

REVOKE ALL ON FUNCTION public.simple_set_draft_slug(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simple_set_draft_slug(uuid,text) TO authenticated,service_role;
