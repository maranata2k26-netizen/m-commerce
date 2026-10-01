create or replace function public.simple_save_personalization(p_site_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_site public.sites;
  v_settings public.settings;
  v_category text;
  v_business_type text := 'retail';
  v_vertical text := 'general';
  v_primary text;
  v_accent text;
  v_instagram text;
  v_simple jsonb;
begin
  if not public.platform_is_site_member(p_site_id) then raise exception 'SITE_ACCESS_DENIED'; end if;
  select * into v_site from public.sites where id=p_site_id and product_tier='simple' for update;
  if v_site.id is null then raise exception 'SIMPLE_SITE_NOT_FOUND'; end if;
  select * into v_settings from public.settings where site_id=p_site_id for update;
  if v_settings.site_id is null then raise exception 'SITE_NOT_FOUND'; end if;

  v_category := lower(trim(coalesce(p_payload->>'business_category',v_settings.business_category,'')));
  if v_category in ('gastronomía','gastronomia','comidas','gastronomy') then
    v_business_type := 'gastronomy'; v_vertical := 'general';
  elsif v_category in ('zapatillas','calzado','footwear') then
    v_business_type := 'retail'; v_vertical := 'footwear';
  elsif v_category in ('ferretería','ferreteria','hardware') then
    v_business_type := 'retail'; v_vertical := 'hardware';
  elsif v_category in ('ropa','indumentaria','fashion') then
    v_business_type := 'retail'; v_vertical := 'fashion';
  elsif v_category in ('joyería','joyeria','jewelry') then
    v_business_type := 'retail'; v_vertical := 'jewelry';
  elsif v_category in ('pinturería','pintureria','paint') then
    v_business_type := 'retail'; v_vertical := 'general';
  else
    v_business_type := 'retail'; v_vertical := 'general';
  end if;

  v_primary := coalesce(nullif(trim(p_payload->>'primary_color'),''),v_settings.primary_color,'#6D5DFC');
  v_accent := coalesce(nullif(trim(p_payload->>'accent_color'),''),v_settings.accent_color,'#3F8CFF');
  if v_primary !~ '^#[0-9A-Fa-f]{6}$' or v_accent !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'INVALID_COLOR'; end if;
  v_instagram := nullif(left(trim(coalesce(p_payload->>'instagram','')),120),'');
  if v_instagram is not null then
    v_instagram := regexp_replace(v_instagram,'^https?://(www\.)?instagram\.com/','','i');
    v_instagram := regexp_replace(v_instagram,'^@','','');
    v_instagram := regexp_replace(v_instagram,'/.*$','','');
    if v_instagram !~ '^[A-Za-z0-9._]{1,30}$' then raise exception 'INVALID_INSTAGRAM'; end if;
  end if;

  v_simple := coalesce(v_settings.site_design->'simple','{}'::jsonb)
    || jsonb_build_object(
      'instagram',v_instagram,
      'business_category',coalesce(nullif(trim(p_payload->>'business_category'),''),v_settings.business_category),
      'vertical_options',coalesce(p_payload->'vertical_options',coalesce(v_settings.site_design->'simple'->'vertical_options','{}'::jsonb))
    );

  update public.settings
  set primary_color=v_primary,
      accent_color=v_accent,
      site_design=jsonb_set(coalesce(site_design,'{}'::jsonb),'{simple}',v_simple,true),
      updated_at=now()
  where site_id=p_site_id returning * into v_settings;

  update public.sites
  set business_type=v_business_type,business_vertical=v_vertical,last_activity_at=now(),updated_at=now()
  where id=p_site_id;

  perform public.platform_audit(p_site_id,'simple_personalization_updated','site',p_site_id::text,
    jsonb_build_object('business_type',v_business_type,'business_vertical',v_vertical));

  return jsonb_build_object('site_id',p_site_id,'primary_color',v_primary,'accent_color',v_accent,'instagram',v_instagram,'business_type',v_business_type,'business_vertical',v_vertical);
end;
$function$;

create or replace function public.simple_design_presets(p_site_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_business_type text;
  v_vertical text;
begin
  if not public.platform_is_site_member(p_site_id) then raise exception 'SITE_ACCESS_DENIED'; end if;
  select coalesce(nullif(trim(business_type),''),'retail'),coalesce(nullif(trim(business_vertical),''),'general')
    into v_business_type,v_vertical
  from public.sites where id=p_site_id and product_tier='simple';
  if v_business_type is null then raise exception 'SIMPLE_SITE_NOT_FOUND'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'preset_key',p.preset_key,'name',p.name,'description',p.description,'version',p.version,
      'preview',p.preview,'swatches',coalesce(p.preview->'swatches','[]'::jsonb),
      'selected',coalesce(st.site_design->'simple'->>'preset_key','')=p.preset_key
    ) order by
      case when coalesce(p.preview->>'businessVertical',p.design_schema->'preset'->>'vertical')=v_vertical then 0 else 1 end,
      p.sort_order,p.name)
    from public.platform_design_presets p
    cross join public.settings st
    where st.site_id=p_site_id and p.active=true
      and (
        coalesce(p.preview->>'businessVertical',p.design_schema->'preset'->>'vertical')=v_vertical
        or (
          coalesce(nullif(p.preview->>'businessVertical',''),nullif(p.design_schema->'preset'->>'vertical','')) is null
          and exists (
            select 1 from jsonb_array_elements_text(coalesce(p.preview->'businessTypes','[]'::jsonb)) bt(value)
            where bt.value=v_business_type
          )
        )
      )
  ),'[]'::jsonb);
end;
$function$;

create or replace function public.simple_apply_design_preset(p_site_id uuid, p_preset_key text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_site public.sites;
  v_settings public.settings;
  v_preset public.platform_design_presets;
  v_allowed boolean := false;
  v_simple jsonb;
  v_primary text;
  v_accent text;
begin
  if not public.platform_is_site_member(p_site_id) then raise exception 'SITE_ACCESS_DENIED'; end if;
  select * into v_site from public.sites where id=p_site_id and product_tier='simple' for update;
  if v_site.id is null then raise exception 'SIMPLE_SITE_NOT_FOUND'; end if;
  select * into v_settings from public.settings where site_id=p_site_id for update;
  select * into v_preset from public.platform_design_presets where preset_key=trim(p_preset_key) and active=true;
  if v_preset.preset_key is null then raise exception 'PRESET_NOT_FOUND'; end if;

  v_allowed := coalesce(v_preset.preview->>'businessVertical',v_preset.design_schema->'preset'->>'vertical')=coalesce(v_site.business_vertical,'general')
    or (
      coalesce(nullif(v_preset.preview->>'businessVertical',''),nullif(v_preset.design_schema->'preset'->>'vertical','')) is null
      and exists(select 1 from jsonb_array_elements_text(coalesce(v_preset.preview->'businessTypes','[]'::jsonb)) bt(value) where bt.value=coalesce(v_site.business_type,'retail'))
    );
  if not v_allowed then raise exception 'PRESET_NOT_ALLOWED'; end if;

  v_simple := coalesce(v_settings.site_design->'simple','{}'::jsonb)
    || jsonb_build_object('preset_key',v_preset.preset_key,'preset_version',v_preset.version);
  v_primary := coalesce(
    v_preset.design_schema->'builder'->'designSystem'->'colors'->>'primary',
    v_preset.design_schema->'theme'->>'primary',v_preset.design_schema->'theme'->>'green',v_settings.primary_color,'#6D5DFC');
  v_accent := coalesce(
    v_preset.design_schema->'builder'->'designSystem'->'colors'->>'secondary',
    v_preset.design_schema->'builder'->'designSystem'->'colors'->>'accent',
    v_preset.design_schema->'theme'->>'gold',v_preset.design_schema->'theme'->>'red',v_settings.accent_color,'#3F8CFF');
  if v_primary !~ '^#[0-9A-Fa-f]{6}$' then v_primary:=coalesce(v_settings.primary_color,'#6D5DFC'); end if;
  if v_accent !~ '^#[0-9A-Fa-f]{6}$' then v_accent:=coalesce(v_settings.accent_color,'#3F8CFF'); end if;

  update public.settings
  set site_design=v_preset.design_schema || jsonb_build_object('simple',v_simple),
      primary_color=v_primary,accent_color=v_accent,updated_at=now()
  where site_id=p_site_id;
  update public.sites set last_activity_at=now(),updated_at=now() where id=p_site_id;
  perform public.platform_audit(p_site_id,'simple_design_preset_applied','design',v_preset.preset_key,jsonb_build_object('version',v_preset.version));
  return jsonb_build_object('applied',true,'preset_key',v_preset.preset_key,'name',v_preset.name,'primary_color',v_primary,'accent_color',v_accent);
end;
$function$;

create or replace function public.simple_delete_product(p_site_id uuid,p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare v_name text;
begin
  if not public.platform_is_site_member(p_site_id) then raise exception 'SITE_ACCESS_DENIED'; end if;
  if not exists(select 1 from public.sites where id=p_site_id and product_tier='simple') then raise exception 'SIMPLE_SITE_REQUIRED'; end if;
  select name into v_name from public.products where site_id=p_site_id and id=p_product_id;
  if v_name is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
  perform public.platform_delete_product(p_site_id,p_product_id);
  return jsonb_build_object('deleted',true,'id',p_product_id,'name',v_name);
end;
$function$;

create or replace function public.simple_delete_category(p_site_id uuid,p_category_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare v_name text; v_count bigint;
begin
  if not public.platform_is_site_member(p_site_id) then raise exception 'SITE_ACCESS_DENIED'; end if;
  if not exists(select 1 from public.sites where id=p_site_id and product_tier='simple') then raise exception 'SIMPLE_SITE_REQUIRED'; end if;
  select name into v_name from public.product_categories where site_id=p_site_id and id=p_category_id;
  if v_name is null then raise exception 'CATEGORY_NOT_FOUND'; end if;
  select count(*) into v_count from public.products where site_id=p_site_id and category_id=p_category_id;
  if v_count>0 then raise exception 'CATEGORY_NOT_EMPTY'; end if;
  delete from public.product_categories where site_id=p_site_id and id=p_category_id;
  perform public.platform_audit(p_site_id,'simple_category_deleted','category',p_category_id::text,jsonb_build_object('name',v_name));
  return jsonb_build_object('deleted',true,'id',p_category_id,'name',v_name);
end;
$function$;

revoke execute on function public.simple_save_personalization(uuid,jsonb) from public,anon;
revoke execute on function public.simple_design_presets(uuid) from public,anon;
revoke execute on function public.simple_apply_design_preset(uuid,text) from public,anon;
revoke execute on function public.simple_delete_product(uuid,uuid) from public,anon;
revoke execute on function public.simple_delete_category(uuid,uuid) from public,anon;
grant execute on function public.simple_save_personalization(uuid,jsonb) to authenticated;
grant execute on function public.simple_design_presets(uuid) to authenticated;
grant execute on function public.simple_apply_design_preset(uuid,text) to authenticated;
grant execute on function public.simple_delete_product(uuid,uuid) to authenticated;
grant execute on function public.simple_delete_category(uuid,uuid) to authenticated;
