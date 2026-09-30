-- Reuse the production-safe settings ID allocation pattern already used by platform_create_site.
-- settings.id is an integer with a legacy default of 1, not a sequence.

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
  v_settings_id integer;
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

  lock table public.settings in share row exclusive mode;
  select coalesce(max(id),0)+1 into v_settings_id from public.settings;

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
    id, business_name, whatsapp_number, address, schedule, delivery_info,
    delivery_fee, site_id, fulfillment_config, payment_methods,
    simple_onboarding_step, site_design, site_design_published
  ) values (
    v_settings_id, v_name, '', '', '', '', 0, v_site.id,
    '{"pickup_enabled":true,"shipping_enabled":false,"shipping_fee":0,"free_shipping_from":null,"allow_custom_estimate":true,"default_estimate_label":""}'::jsonb,
    '{"cash":true,"transfer":true,"mercadopago":false}'::jsonb,
    1,
    '{"system":"m-commerce-simple-v1"}'::jsonb,
    null
  );

  update public.sites
  set settings_id=v_settings_id, updated_at=now()
  where id=v_site.id;

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
    'subscription_status','pending',
    'public_url','/tienda/' || v_site.slug
  );
end;
$$;

revoke all on function public.simple_create_store(text,text) from public;
grant execute on function public.simple_create_store(text,text) to authenticated;
