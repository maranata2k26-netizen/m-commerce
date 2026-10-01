create or replace function public.simple_save_store_profile(
  p_site_id uuid,
  p_profile jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_settings public.settings;
  v_step integer;
  v_methods jsonb;
  v_fulfillment jsonb;
  v_lat numeric;
  v_lng numeric;
begin
  if not public.platform_is_site_member(p_site_id) then raise exception 'SITE_ACCESS_DENIED'; end if;
  if not exists (
    select 1 from public.sites where id=p_site_id and product_tier='simple'
  ) then raise exception 'SIMPLE_SITE_REQUIRED';
  end if;

  v_step := greatest(1, least(10, coalesce((p_profile->>'onboarding_step')::integer,1)));
  v_methods := coalesce(p_profile->'payment_methods','{}'::jsonb);
  v_fulfillment := coalesce(p_profile->'fulfillment_config','{}'::jsonb);
  if jsonb_typeof(v_methods) <> 'object' or jsonb_typeof(v_fulfillment) <> 'object' then
    raise exception 'INVALID_CONFIGURATION';
  end if;

  if p_profile ? 'business_latitude' then
    v_lat := nullif(p_profile->>'business_latitude','')::numeric;
    if v_lat is not null and (v_lat < -90 or v_lat > 90) then raise exception 'INVALID_BUSINESS_LOCATION'; end if;
  end if;
  if p_profile ? 'business_longitude' then
    v_lng := nullif(p_profile->>'business_longitude','')::numeric;
    if v_lng is not null and (v_lng < -180 or v_lng > 180) then raise exception 'INVALID_BUSINESS_LOCATION'; end if;
  end if;
  if (p_profile ? 'business_latitude') <> (p_profile ? 'business_longitude') then
    raise exception 'INVALID_BUSINESS_LOCATION';
  end if;
  if (p_profile ? 'business_latitude') and ((v_lat is null) <> (v_lng is null)) then
    raise exception 'INVALID_BUSINESS_LOCATION';
  end if;

  if coalesce((v_methods->>'mercadopago')::boolean,false)
     and not exists (
       select 1 from public.mercadopago_connections
       where site_id=p_site_id and status='connected'
     ) then
    raise exception 'MERCADOPAGO_NOT_CONNECTED';
  end if;

  update public.settings set
    business_name = left(trim(coalesce(p_profile->>'business_name',business_name)),100),
    logo_url = nullif(left(trim(coalesce(p_profile->>'logo_url','')),2000),''),
    cover_url = nullif(left(trim(coalesce(p_profile->>'cover_url','')),2000),''),
    business_category = nullif(left(trim(coalesce(p_profile->>'business_category','')),80),''),
    whatsapp_number = left(trim(coalesce(p_profile->>'whatsapp_number',whatsapp_number)),40),
    address = left(trim(coalesce(p_profile->>'address',address)),500),
    business_latitude = case when p_profile ? 'business_latitude' then v_lat else business_latitude end,
    business_longitude = case when p_profile ? 'business_longitude' then v_lng else business_longitude end,
    business_place_id = case when p_profile ? 'business_place_id' then nullif(left(trim(coalesce(p_profile->>'business_place_id','')),240),'') else business_place_id end,
    business_address_formatted = case when p_profile ? 'business_address_formatted' then nullif(left(trim(coalesce(p_profile->>'business_address_formatted','')),500),'') else business_address_formatted end,
    schedule = left(trim(coalesce(p_profile->>'schedule',schedule)),1000),
    payment_methods = v_methods,
    fulfillment_config = v_fulfillment,
    simple_onboarding_step = v_step,
    updated_at = now()
  where site_id=p_site_id
  returning * into v_settings;

  if v_settings.site_id is null then raise exception 'SITE_NOT_FOUND'; end if;
  update public.sites set name=v_settings.business_name,last_activity_at=now(),updated_at=now()
  where id=p_site_id;

  perform public.platform_audit(
    p_site_id, 'simple_profile_updated', 'site', p_site_id::text,
    jsonb_build_object('onboarding_step',v_step,'has_exact_business_location',v_settings.business_latitude is not null and v_settings.business_longitude is not null)
  );

  return jsonb_build_object(
    'site_id',p_site_id,
    'onboarding_step',v_settings.simple_onboarding_step,
    'business_name',v_settings.business_name,
    'business_latitude',v_settings.business_latitude,
    'business_longitude',v_settings.business_longitude,
    'business_place_id',v_settings.business_place_id,
    'business_address_formatted',v_settings.business_address_formatted
  );
exception when invalid_text_representation then
  raise exception 'INVALID_CONFIGURATION';
end;
$function$;

grant execute on function public.simple_save_store_profile(uuid,jsonb) to authenticated;

create or replace function public.simple_public_storefront(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare v_store jsonb; v_site uuid; v_categories jsonb; v_branding jsonb;
begin
  select id into v_site from public.sites
  where lower(slug)=lower(trim(p_slug))
    and product_tier='simple'
    and status='published'
    and is_suspended=false
    and subscription_status in ('trial','active')
  limit 1;
  if v_site is null then return null; end if;

  v_store := public.platform_get_storefront(p_slug);
  select jsonb_build_object(
    'logo_url',st.logo_url,'cover_url',st.cover_url,
    'business_category',st.business_category,'payment_methods',st.payment_methods,
    'business_latitude',st.business_latitude,'business_longitude',st.business_longitude,
    'business_place_id',st.business_place_id,'business_address_formatted',st.business_address_formatted
  ) into v_branding from public.settings st where st.site_id=v_site;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order,c.name),'[]'::jsonb)
  into v_categories
  from public.product_categories c
  where c.site_id=v_site and c.active;

  return jsonb_set(v_store,'{settings}',coalesce(v_store->'settings','{}'::jsonb) || coalesce(v_branding,'{}'::jsonb),true)
    || jsonb_build_object('categories',v_categories,'product_tier','simple');
end;
$function$;

grant execute on function public.simple_public_storefront(text) to anon, authenticated;

create or replace function public.simple_preview_storefront(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_site public.sites;
  v_settings public.settings;
  v_categories jsonb;
  v_products jsonb;
  v_variants jsonb;
begin
  select * into v_site from public.sites
  where lower(slug)=lower(trim(p_slug)) and product_tier='simple'
  limit 1;
  if v_site.id is null then return null; end if;
  if not public.platform_is_site_member(v_site.id) then raise exception 'SITE_ACCESS_DENIED'; end if;

  select * into v_settings from public.settings where site_id=v_site.id limit 1;
  if v_settings.site_id is null then raise exception 'SITE_NOT_FOUND'; end if;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order,c.name),'[]'::jsonb)
    into v_categories from public.product_categories c where c.site_id=v_site.id and c.active;

  select coalesce(jsonb_agg(to_jsonb(p) || jsonb_build_object(
      'effective_available',p.active and p.availability_status='available' and (not p.stock_tracking or coalesce(p.stock_quantity,0)>0)
    ) order by p.sort_order,p.created_at),'[]'::jsonb)
    into v_products from public.products p where p.site_id=v_site.id and p.active=true;

  select coalesce(jsonb_agg(to_jsonb(v) order by v.product_id,v.sort_order,v.name),'[]'::jsonb)
    into v_variants from public.product_variants v where v.site_id=v_site.id and v.active=true;

  return jsonb_build_object(
    'site',jsonb_build_object(
      'id',v_site.id,'name',v_site.name,'slug',v_site.slug,
      'accepting_orders',false,'order_state',jsonb_build_object('open',false,'reason','preview'),
      'country_code',v_site.country_code,'currency_code',v_site.currency_code,
      'locale_code',v_site.locale_code,'default_payment_provider',v_site.default_payment_provider,
      'business_type',coalesce(v_site.business_type,'retail'),'business_vertical',coalesce(v_site.business_vertical,'general')
    ),
    'settings',jsonb_build_object(
      'business_name',v_settings.business_name,'whatsapp_number',v_settings.whatsapp_number,
      'address',v_settings.address,'schedule',v_settings.schedule,
      'fulfillment_config',coalesce(v_settings.fulfillment_config,'{}'::jsonb),
      'payment_methods',coalesce(v_settings.payment_methods,'{}'::jsonb),
      'primary_color',v_settings.primary_color,'accent_color',v_settings.accent_color,
      'logo_url',v_settings.logo_url,'cover_url',v_settings.cover_url,
      'business_category',v_settings.business_category,
      'business_latitude',v_settings.business_latitude,'business_longitude',v_settings.business_longitude,
      'business_place_id',v_settings.business_place_id,'business_address_formatted',v_settings.business_address_formatted
    ),
    'design',coalesce(v_settings.site_design,'{}'::jsonb),
    'products',v_products,'variants',v_variants,'categories',v_categories,'product_tier','simple','preview',true
  );
end;
$function$;

grant execute on function public.simple_preview_storefront(text) to authenticated;
