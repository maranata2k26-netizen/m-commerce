-- Item 9: merchant-managed Simple delivery settings.
-- Staging first; production is strictly read-only.
-- Flat fee is authoritative in public.settings.delivery_fee and in the checkout RPC.
-- delivery_info is informational coverage text, NOT automated geofencing.
create or replace function public.simple_update_delivery_settings(
  p_site_id uuid, p_config jsonb, p_expected_updated_at timestamptz
) returns jsonb
language plpgsql security definer set search_path to ''
as $fn$
declare
  v_settings public.settings;
  v_pickup boolean;
  v_shipping boolean;
  v_fee numeric;
  v_info text;
begin
  if not public.platform_is_site_member(p_site_id) then
    raise exception 'SITE_ACCESS_DENIED';
  end if;
  if not exists (select 1 from public.sites
                 where id=p_site_id and product_tier='simple') then
    raise exception 'SIMPLE_SITE_REQUIRED';
  end if;
  if p_config is null or jsonb_typeof(p_config)<>'object'
     or jsonb_typeof(p_config->'pickup_enabled') is distinct from 'boolean'
     or jsonb_typeof(p_config->'shipping_enabled') is distinct from 'boolean'
     or jsonb_typeof(p_config->'delivery_fee') is distinct from 'number'
     or jsonb_typeof(p_config->'delivery_info') is distinct from 'string' then
    raise exception 'INVALID_DELIVERY_CONFIGURATION';
  end if;
  v_pickup:=(p_config->>'pickup_enabled')::boolean;
  v_shipping:=(p_config->>'shipping_enabled')::boolean;
  v_fee:=(p_config->>'delivery_fee')::numeric;
  v_info:=trim(p_config->>'delivery_info');
  if not (v_pickup or v_shipping) then raise exception 'DELIVERY_METHOD_REQUIRED'; end if;
  if v_fee < 0 or v_fee > 10000000 or v_fee <> round(v_fee,2) then
    raise exception 'INVALID_DELIVERY_FEE';
  end if;
  if length(v_info)>500 then raise exception 'DELIVERY_INFO_TOO_LONG'; end if;

  select * into v_settings from public.settings
  where site_id=p_site_id for update;
  if v_settings.site_id is null then raise exception 'SITE_NOT_FOUND'; end if;
  if p_expected_updated_at is null then raise exception 'EXPECTED_VERSION_REQUIRED'; end if;
  if v_settings.updated_at is distinct from p_expected_updated_at then
    raise exception 'DELIVERY_SETTINGS_CHANGED_RELOAD';
  end if;

  update public.settings set
    delivery_fee=v_fee,
    delivery_info=nullif(v_info,''),
    fulfillment_config=coalesce(fulfillment_config,'{}'::jsonb)
      || jsonb_build_object('pickup_enabled',v_pickup,
                            'shipping_enabled',v_shipping,
                            'shipping_fee',v_fee),
    updated_at=clock_timestamp()
  where site_id=p_site_id
  returning * into v_settings;

  perform public.platform_audit(
    p_site_id,'simple_delivery_settings_updated','site',p_site_id::text,
    jsonb_build_object('pickup_enabled',v_pickup,'shipping_enabled',v_shipping,
                       'fee',v_fee,'has_coverage_note',length(v_info)>0)
  );
  return jsonb_build_object(
    'site_id',p_site_id,'updated_at',v_settings.updated_at,
    'pickup_enabled',v_pickup,'shipping_enabled',v_shipping,
    'delivery_fee',v_settings.delivery_fee,
    'delivery_info',v_settings.delivery_info,
    'fulfillment_config',v_settings.fulfillment_config
  );
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'INVALID_DELIVERY_CONFIGURATION';
end;
$fn$;

revoke all on function public.simple_update_delivery_settings(uuid,jsonb,timestamptz)
  from public, anon;
grant execute on function public.simple_update_delivery_settings(uuid,jsonb,timestamptz)
  to authenticated,service_role;
