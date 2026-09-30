-- Keep Simple offline payments isolated from the legacy shared checkout contract.
-- The shared engine only accepts cash/mercadopago. This wrapper creates the order
-- through that proven engine and normalizes transfer atomically before commit.

create or replace function public.simple_create_offline_order(
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_delivery_method text,
  p_notes text,
  p_payment_method text,
  p_site_id uuid,
  p_items jsonb,
  p_checkout_attempt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_order_id uuid;
begin
  if auth.role() <> 'service_role' and session_user not in ('postgres','supabase_admin') then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_payment_method not in ('cash','transfer') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;
  if not exists (
    select 1
    from public.sites
    where id=p_site_id
      and product_tier='simple'
      and status='published'
      and not is_suspended
      and subscription_status in ('trial','active')
  ) then
    raise exception 'SIMPLE_SITE_NOT_AVAILABLE';
  end if;

  v_result := public.create_checkout_order_v117(
    p_customer_name => p_customer_name,
    p_customer_phone => p_customer_phone,
    p_customer_email => '',
    p_delivery_address => p_delivery_address,
    p_delivery_method => p_delivery_method,
    p_notes => p_notes,
    p_payment_method => 'cash',
    p_site_id => p_site_id,
    p_items => p_items,
    p_checkout_attempt_id => p_checkout_attempt_id,
    p_delivery_latitude => null,
    p_delivery_longitude => null,
    p_delivery_place_id => null,
    p_delivery_address_formatted => null,
    p_delivery_address_source => case when p_delivery_method='delivery' then 'manual' else null end,
    p_delivery_unit => null,
    p_delivery_instructions => null,
    p_promotion_code => null,
    p_marketing_opt_in => false,
    p_redeem_points => false,
    p_cart_token => null,
    p_order_source => 'simple'
  );

  v_order_id := nullif(v_result->>'id','')::uuid;
  if v_order_id is null then raise exception 'ORDER_CREATE_FAILED'; end if;

  if p_payment_method='transfer' then
    update public.orders
    set payment_method='transfer',
        payment_status='unpaid',
        payment_provider=null
    where id=v_order_id and site_id=p_site_id;
    if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  end if;

  return v_result || jsonb_build_object('payment_method',p_payment_method);
end;
$$;

revoke all on function public.simple_create_offline_order(text,text,text,text,text,text,uuid,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.simple_create_offline_order(text,text,text,text,text,text,uuid,jsonb,uuid) to service_role;
