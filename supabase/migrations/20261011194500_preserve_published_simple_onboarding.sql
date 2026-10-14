-- Item 6: completing or re-editing a Simple store must NEVER unpublish an already published storefront.
-- Preserve legacy behavior for draft stores; no existing site data is modified.
CREATE OR REPLACE FUNCTION public.simple_complete_onboarding(p_site_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_site public.sites;
  v_missing text[] := array[]::text[];
begin
  if not public.platform_is_site_member(p_site_id) then raise exception 'SITE_ACCESS_DENIED'; end if;
  select * into v_site from public.sites where id=p_site_id and product_tier='simple' for update;
  if v_site.id is null then raise exception 'SIMPLE_SITE_NOT_FOUND'; end if;

  if not exists (select 1 from public.settings where site_id=p_site_id and char_length(trim(whatsapp_number))>=8)
    then v_missing:=array_append(v_missing,'whatsapp'); end if;
  if not exists (select 1 from public.product_categories where site_id=p_site_id and active)
    then v_missing:=array_append(v_missing,'category'); end if;
  if not exists (select 1 from public.products where site_id=p_site_id and active)
    then v_missing:=array_append(v_missing,'product'); end if;
  if cardinality(v_missing)>0 then
    return jsonb_build_object('ready',false,'missing',to_jsonb(v_missing));
  end if;

  update public.settings set simple_onboarding_step=10,updated_at=now() where site_id=p_site_id;
  update public.sites set
    simple_onboarding_completed_at=coalesce(simple_onboarding_completed_at,now()),
    status=case when v_site.status='published' then 'published' else 'draft' end, last_activity_at=now(), updated_at=now()
  where id=p_site_id returning * into v_site;

  perform public.platform_audit(p_site_id,'simple_onboarding_completed','site',p_site_id::text,jsonb_build_object('status',v_site.status));
  return jsonb_build_object('ready',true,'site_id',p_site_id,'slug',v_site.slug,'status',v_site.status,'preview_url','/tienda/'||v_site.slug||'?preview=1');
end;
$function$
;
