-- M Commerce Simple foundation
-- Incremental and backward compatible: every existing site remains PRO.
begin;

alter table public.sites
  add column if not exists product_tier text not null default 'pro',
  add column if not exists simple_onboarding_completed_at timestamptz,
  add column if not exists last_activity_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sites_product_tier_check'
  ) then
    alter table public.sites
      add constraint sites_product_tier_check
      check (product_tier in ('pro','simple'));
  end if;
end $$;

create index if not exists sites_product_tier_created_idx
  on public.sites(product_tier, created_at desc);

alter table public.subscription_plans
  add column if not exists code text,
  add column if not exists product_tier text not null default 'pro',
  add column if not exists currency_code text not null default 'ARS',
  add column if not exists features jsonb not null default '{}'::jsonb;

create unique index if not exists subscription_plans_code_unique_idx
  on public.subscription_plans(code) where code is not null;

insert into public.subscription_plans(name, monthly_price, active, code, product_tier, currency_code, features)
select 'M Commerce Simple', 25000, true, 'simple-monthly', 'simple', 'ARS',
       '{"catalog":true,"orders":true,"whatsapp":true,"products_limit":null}'::jsonb
where not exists (
  select 1 from public.subscription_plans where code = 'simple-monthly'
);

alter table public.settings
  add column if not exists logo_url text,
  add column if not exists cover_url text,
  add column if not exists business_category text,
  add column if not exists payment_methods jsonb not null
    default '{"cash":true,"transfer":true,"mercadopago":false}'::jsonb,
  add column if not exists simple_onboarding_step integer not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'settings_simple_onboarding_step_check'
  ) then
    alter table public.settings
      add constraint settings_simple_onboarding_step_check
      check (simple_onboarding_step between 1 and 10);
  end if;
end $$;

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(site_id, slug),
  unique(id, site_id)
);

alter table public.product_categories enable row level security;

revoke all on table public.product_categories from anon, authenticated;
grant select, insert, update, delete on table public.product_categories to authenticated;

drop policy if exists "simple members read categories" on public.product_categories;
create policy "simple members read categories"
  on public.product_categories for select to authenticated
  using ((select public.platform_is_site_member(site_id)));

drop policy if exists "simple members insert categories" on public.product_categories;
create policy "simple members insert categories"
  on public.product_categories for insert to authenticated
  with check ((select public.platform_is_site_member(site_id)));

drop policy if exists "simple members update categories" on public.product_categories;
create policy "simple members update categories"
  on public.product_categories for update to authenticated
  using ((select public.platform_is_site_member(site_id)))
  with check ((select public.platform_is_site_member(site_id)));

drop policy if exists "simple members delete categories" on public.product_categories;
create policy "simple members delete categories"
  on public.product_categories for delete to authenticated
  using ((select public.platform_is_site_member(site_id)));

alter table public.products
  add column if not exists category_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_category_site_fkey'
  ) then
    alter table public.products
      add constraint products_category_site_fkey
      foreign key (category_id, site_id)
      references public.product_categories(id, site_id)
      on delete set null;
  end if;
end $$;

create index if not exists product_categories_site_sort_idx
  on public.product_categories(site_id, active, sort_order, name);
create index if not exists products_site_category_idx
  on public.products(site_id, category_id, active, sort_order);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'simple-store-images',
  'simple-store-images',
  true,
  8388608,
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read simple store images" on storage.objects;
create policy "public read simple store images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'simple-store-images');

drop policy if exists "simple members upload store images" on storage.objects;
create policy "simple members upload store images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'simple-store-images'
    and (storage.foldername(name))[1] = 'sites'
    and array_length(storage.foldername(name), 1) >= 2
    and (select public.platform_is_site_member(((storage.foldername(name))[2])::uuid))
  );

drop policy if exists "simple members update store images" on storage.objects;
create policy "simple members update store images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'simple-store-images'
    and (storage.foldername(name))[1] = 'sites'
    and array_length(storage.foldername(name), 1) >= 2
    and (select public.platform_is_site_member(((storage.foldername(name))[2])::uuid))
  )
  with check (
    bucket_id = 'simple-store-images'
    and (storage.foldername(name))[1] = 'sites'
    and array_length(storage.foldername(name), 1) >= 2
    and (select public.platform_is_site_member(((storage.foldername(name))[2])::uuid))
  );

drop policy if exists "simple members delete store images" on storage.objects;
create policy "simple members delete store images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'simple-store-images'
    and (storage.foldername(name))[1] = 'sites'
    and array_length(storage.foldername(name), 1) >= 2
    and (select public.platform_is_site_member(((storage.foldername(name))[2])::uuid))
  );

create or replace function public.simple_slugify(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    translate(lower(trim(coalesce(p_value,''))),
      'áéíóúüñ',
      'aeiouun'),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

revoke all on function public.simple_slugify(text) from public;
grant execute on function public.simple_slugify(text) to authenticated, service_role;

create or replace function public.simple_create_store(
  p_name text,
  p_slug text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text := trim(coalesce(p_name,''));
  v_slug text := public.simple_slugify(coalesce(nullif(trim(p_slug),''), p_name));
  v_site public.sites;
  v_plan uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(v_name) not between 2 and 100 then raise exception 'INVALID_STORE_NAME'; end if;
  if char_length(v_slug) not between 3 and 60 then raise exception 'INVALID_STORE_SLUG'; end if;
  if exists (
    select 1 from public.sites s
    where s.owner_id = v_user and s.product_tier = 'simple'
      and s.subscription_status <> 'cancelled'
  ) then
    raise exception 'SIMPLE_STORE_ALREADY_EXISTS';
  end if;
  if exists (select 1 from public.sites s where lower(s.slug)=lower(v_slug)) then
    raise exception 'SLUG_ALREADY_EXISTS';
  end if;

  select id into v_plan
  from public.subscription_plans
  where code='simple-monthly' and active
  limit 1;
  if v_plan is null then raise exception 'SIMPLE_PLAN_NOT_CONFIGURED'; end if;

  insert into public.sites(
    owner_id, name, slug, status, subscription_status, is_suspended,
    accepting_orders, order_control_mode, country_code, currency_code,
    locale_code, default_payment_provider, business_type, business_vertical,
    product_tier, metadata, last_activity_at
  ) values (
    v_user, v_name, v_slug, 'draft', 'pending', false,
    true, 'manual', 'AR', 'ARS', 'es-AR', 'mercadopago',
    'retail', 'general', 'simple',
    jsonb_build_object('created_via','simple_self_service'), now()
  ) returning * into v_site;

  insert into public.site_memberships(
    site_id, user_id, email, full_name, role, status, joined_at
  )
  select v_site.id, v_user, coalesce(u.email,''), coalesce(p.full_name,''),
         'merchant_owner', 'active', now()
  from auth.users u
  left join public.profiles p on p.id=u.id
  where u.id=v_user;

  insert into public.settings(
    business_name, whatsapp_number, address, schedule, delivery_info,
    delivery_fee, site_id, fulfillment_config, payment_methods,
    simple_onboarding_step, site_design, site_design_published
  ) values (
    v_name, '', '', '', '', 0, v_site.id,
    '{"pickup_enabled":true,"shipping_enabled":false,"shipping_fee":0,"free_shipping_from":null,"allow_custom_estimate":true,"default_estimate_label":""}'::jsonb,
    '{"cash":true,"transfer":true,"mercadopago":false}'::jsonb,
    1,
    '{"system":"m-commerce-simple-v1"}'::jsonb,
    null
  );

  insert into public.site_subscriptions(
    site_id, plan_id, status, billing_mode, provider, grace_days
  ) values (
    v_site.id, v_plan, 'pending', 'auto', 'mercadopago', 3
  );

  perform public.platform_audit(
    v_site.id, 'simple_store_created', 'site', v_site.id::text,
    jsonb_build_object('tier','simple','source','self_service')
  );

  return jsonb_build_object(
    'id',v_site.id,
    'name',v_site.name,
    'slug',v_site.slug,
    'status',v_site.status,
    'product_tier','simple',
    'subscription_status',v_site.subscription_status,
    'public_url','/tienda/' || v_site.slug
  );
end;
$$;

revoke all on function public.simple_create_store(text,text) from public;
grant execute on function public.simple_create_store(text,text) to authenticated;

create or replace function public.simple_save_store_profile(
  p_site_id uuid,
  p_profile jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.settings;
  v_step integer;
  v_methods jsonb;
  v_fulfillment jsonb;
begin
  if not public.platform_is_site_member(p_site_id) then raise exception 'SITE_ACCESS_DENIED'; end if;
  if not exists (
    select 1 from public.sites where id=p_site_id and product_tier='simple'
  ) then raise exception 'SIMPLE_SITE_REQUIRED'; end if;

  v_step := greatest(1, least(10, coalesce((p_profile->>'onboarding_step')::integer,1)));
  v_methods := coalesce(p_profile->'payment_methods','{}'::jsonb);
  v_fulfillment := coalesce(p_profile->'fulfillment_config','{}'::jsonb);
  if jsonb_typeof(v_methods) <> 'object' or jsonb_typeof(v_fulfillment) <> 'object' then
    raise exception 'INVALID_CONFIGURATION';
  end if;

  update public.settings set
    business_name = left(trim(coalesce(p_profile->>'business_name',business_name)),100),
    logo_url = nullif(left(trim(coalesce(p_profile->>'logo_url','')),2000),''),
    cover_url = nullif(left(trim(coalesce(p_profile->>'cover_url','')),2000),''),
    business_category = nullif(left(trim(coalesce(p_profile->>'business_category','')),80),''),
    whatsapp_number = left(trim(coalesce(p_profile->>'whatsapp_number',whatsapp_number)),40),
    address = left(trim(coalesce(p_profile->>'address',address)),500),
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
    jsonb_build_object('onboarding_step',v_step)
  );

  return jsonb_build_object(
    'site_id',p_site_id,
    'onboarding_step',v_settings.simple_onboarding_step,
    'business_name',v_settings.business_name
  );
exception when invalid_text_representation then
  raise exception 'INVALID_CONFIGURATION';
end;
$$;

revoke all on function public.simple_save_store_profile(uuid,jsonb) from public;
grant execute on function public.simple_save_store_profile(uuid,jsonb) to authenticated;

create or replace function public.simple_upsert_category(
  p_site_id uuid,
  p_category jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text := trim(coalesce(p_category->>'name',''));
  v_slug text;
  v_row public.product_categories;
begin
  if not public.platform_is_site_member(p_site_id) then raise exception 'SITE_ACCESS_DENIED'; end if;
  if not exists (select 1 from public.sites where id=p_site_id and product_tier='simple') then
    raise exception 'SIMPLE_SITE_REQUIRED';
  end if;
  if char_length(v_name) not between 1 and 80 then raise exception 'INVALID_CATEGORY_NAME'; end if;
  v_slug := public.simple_slugify(coalesce(nullif(p_category->>'slug',''),v_name));
  begin v_id := nullif(p_category->>'id','')::uuid;
  exception when others then raise exception 'INVALID_CATEGORY_ID'; end;

  if v_id is null then
    insert into public.product_categories(site_id,name,slug,sort_order,active)
    values(
      p_site_id,v_name,v_slug,
      coalesce((p_category->>'sort_order')::integer,0),
      coalesce((p_category->>'active')::boolean,true)
    ) returning * into v_row;
  else
    update public.product_categories set
      name=v_name, slug=v_slug,
      sort_order=coalesce((p_category->>'sort_order')::integer,sort_order),
      active=coalesce((p_category->>'active')::boolean,active),
      updated_at=now()
    where id=v_id and site_id=p_site_id
    returning * into v_row;
    if v_row.id is null then raise exception 'CATEGORY_NOT_FOUND'; end if;
  end if;

  update public.sites set last_activity_at=now(),updated_at=now() where id=p_site_id;
  perform public.platform_audit(
    p_site_id,
    case when v_id is null then 'simple_category_created' else 'simple_category_updated' end,
    'category',v_row.id::text,jsonb_build_object('name',v_row.name)
  );
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.simple_upsert_category(uuid,jsonb) from public;
grant execute on function public.simple_upsert_category(uuid,jsonb) to authenticated;

create or replace function public.simple_dashboard(p_site_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if not public.platform_is_site_member(p_site_id) then raise exception 'SITE_ACCESS_DENIED'; end if;
  select jsonb_build_object(
    'site', jsonb_build_object(
      'id',s.id,'name',s.name,'slug',s.slug,'status',s.status,
      'product_tier',s.product_tier,'subscription_status',s.subscription_status,
      'is_suspended',s.is_suspended,'created_at',s.created_at,
      'last_activity_at',s.last_activity_at
    ),
    'settings', to_jsonb(st),
    'subscription', case when sub.site_id is null then null else
      jsonb_build_object(
        'status',sub.status,'next_due_at',sub.next_due_at,
        'amount',coalesce(sub.amount_override,pl.monthly_price),
        'currency_code',coalesce(pl.currency_code,'ARS')
      ) end,
    'counts', jsonb_build_object(
      'products',(select count(*) from public.products p where p.site_id=s.id),
      'categories',(select count(*) from public.product_categories c where c.site_id=s.id),
      'orders',(select count(*) from public.orders o where o.site_id=s.id),
      'new_orders',(select count(*) from public.orders o where o.site_id=s.id and o.status='new')
    )
  ) into v_result
  from public.sites s
  join public.settings st on st.site_id=s.id
  left join public.site_subscriptions sub on sub.site_id=s.id
  left join public.subscription_plans pl on pl.id=sub.plan_id
  where s.id=p_site_id and s.product_tier='simple';

  if v_result is null then raise exception 'SIMPLE_SITE_NOT_FOUND'; end if;
  return v_result;
end;
$$;

revoke all on function public.simple_dashboard(uuid) from public;
grant execute on function public.simple_dashboard(uuid) to authenticated;

create or replace function public.simple_complete_onboarding(p_site_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
    last_activity_at=now(),
    updated_at=now()
  where id=p_site_id returning * into v_site;

  perform public.platform_audit(
    p_site_id,'simple_onboarding_completed','site',p_site_id::text,'{}'::jsonb
  );
  return jsonb_build_object(
    'ready',true,'site_id',p_site_id,'slug',v_site.slug,
    'public_url','/tienda/'||v_site.slug
  );
end;
$$;

revoke all on function public.simple_complete_onboarding(uuid) from public;
grant execute on function public.simple_complete_onboarding(uuid) to authenticated;

-- Existing PRO behavior remains the default. Public storefront data gains categories
-- without exposing private membership, subscription, or payment records.
create or replace function public.simple_public_storefront(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_store jsonb; v_site uuid; v_categories jsonb;
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
  select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order,c.name),'[]'::jsonb)
  into v_categories
  from public.product_categories c
  where c.site_id=v_site and c.active;

  return v_store || jsonb_build_object('categories',v_categories,'product_tier','simple');
end;
$$;

revoke all on function public.simple_public_storefront(text) from public;
grant execute on function public.simple_public_storefront(text) to anon, authenticated;

commit;
