create or replace function public.simple_ensure_store()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_existing jsonb;
  v_slug text;
  v_created jsonb;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  perform pg_advisory_xact_lock(hashtextextended('mcommerce-simple:' || v_user::text, 41873));

  select jsonb_build_object(
    'id',s.id,'name',s.name,'slug',s.slug,'status',s.status,
    'product_tier',s.product_tier,'subscription_status',s.subscription_status,
    'is_suspended',s.is_suspended,'created_at',s.created_at
  ) into v_existing
  from public.site_memberships m
  join public.sites s on s.id=m.site_id
  where m.user_id=v_user and m.status='active' and s.product_tier='simple'
  order by s.created_at
  limit 1;

  if v_existing is not null then return v_existing; end if;

  select jsonb_build_object(
    'id',s.id,'name',s.name,'slug',s.slug,'status',s.status,
    'product_tier',s.product_tier,'subscription_status',s.subscription_status,
    'is_suspended',s.is_suspended,'created_at',s.created_at
  ) into v_existing
  from public.sites s
  where s.owner_id=v_user and s.product_tier='simple' and s.subscription_status <> 'cancelled'
  order by s.created_at
  limit 1;

  if v_existing is not null then
    insert into public.site_memberships(site_id,user_id,email,full_name,role,status,joined_at)
    select (v_existing->>'id')::uuid, v_user, coalesce(u.email,''), coalesce(p.full_name,''), 'merchant_owner', 'active', now()
    from auth.users u left join public.profiles p on p.id=u.id where u.id=v_user
    on conflict do nothing;
    return v_existing;
  end if;

  v_slug := 'tienda-' || substr(replace(v_user::text,'-',''),1,12);
  if exists(select 1 from public.sites where lower(slug)=lower(v_slug)) then
    v_slug := v_slug || '-' || substr(md5(v_user::text || clock_timestamp()::text),1,6);
  end if;

  v_created := public.simple_create_store('Mi tienda', v_slug);
  update public.sites
  set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('created_via','simple_email_onboarding','auto_slug',true),
      status='draft', updated_at=now()
  where id=(v_created->>'id')::uuid;

  return v_created || jsonb_build_object('status','draft');
end;
$function$;

grant execute on function public.simple_ensure_store() to authenticated;

create or replace function public.simple_update_draft_identity(p_site_id uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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

  if coalesce((v_site.metadata->>'auto_slug')::boolean,false) or v_site.slug like 'tienda-%' then
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
$function$;

grant execute on function public.simple_update_draft_identity(uuid,text) to authenticated;

create or replace function public.simple_complete_onboarding(p_site_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
    status='draft', last_activity_at=now(), updated_at=now()
  where id=p_site_id returning * into v_site;

  perform public.platform_audit(p_site_id,'simple_onboarding_completed','site',p_site_id::text,jsonb_build_object('status','draft'));
  return jsonb_build_object('ready',true,'site_id',p_site_id,'slug',v_site.slug,'status','draft','preview_url','/tienda/'||v_site.slug||'?preview=1');
end;
$function$;

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
      'business_category',v_settings.business_category
    ),
    'design',coalesce(v_settings.site_design,'{}'::jsonb),
    'products',v_products,'variants',v_variants,'categories',v_categories,'product_tier','simple','preview',true
  );
end;
$function$;

grant execute on function public.simple_preview_storefront(text) to authenticated;

create or replace function public.simple_publish_store(p_site_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_site public.sites;
  v_settings public.settings;
  v_missing text[] := array[]::text[];
begin
  if not public.platform_is_site_member(p_site_id) then raise exception 'SITE_ACCESS_DENIED'; end if;
  select * into v_site from public.sites where id=p_site_id and product_tier='simple' for update;
  if v_site.id is null then raise exception 'SIMPLE_SITE_NOT_FOUND'; end if;
  if v_site.is_suspended then raise exception 'SITE_SUSPENDED'; end if;
  if v_site.simple_onboarding_completed_at is null then raise exception 'ONBOARDING_REQUIRED'; end if;
  if v_site.subscription_status not in ('trial','active','buyout') then raise exception 'SUBSCRIPTION_REQUIRED'; end if;

  select * into v_settings from public.settings where site_id=p_site_id;
  if v_settings.site_id is null then raise exception 'SITE_NOT_FOUND'; end if;
  if char_length(trim(coalesce(v_site.name,'')))<2 then v_missing:=array_append(v_missing,'name'); end if;
  if char_length(trim(coalesce(v_site.slug,'')))<3 then v_missing:=array_append(v_missing,'slug'); end if;
  if char_length(trim(coalesce(v_settings.whatsapp_number,'')))<8 then v_missing:=array_append(v_missing,'whatsapp'); end if;
  if not exists(select 1 from public.product_categories where site_id=p_site_id and active) then v_missing:=array_append(v_missing,'category'); end if;
  if not exists(select 1 from public.products where site_id=p_site_id and active) then v_missing:=array_append(v_missing,'product'); end if;
  if cardinality(v_missing)>0 then return jsonb_build_object('published',false,'missing',to_jsonb(v_missing)); end if;

  perform public.platform_publish_site(p_site_id,'Publicación M Commerce Simple');
  select * into v_site from public.sites where id=p_site_id;
  return jsonb_build_object('published',true,'site_id',p_site_id,'slug',v_site.slug,'status',v_site.status,'public_url','/tienda/'||v_site.slug);
end;
$function$;

grant execute on function public.simple_publish_store(uuid) to authenticated;