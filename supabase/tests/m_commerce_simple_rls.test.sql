begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

select tests.create_supabase_user('simple_owner_a');
select tests.create_supabase_user('simple_owner_b');
select tests.create_supabase_user('simple_outsider');

select tests.authenticate_as('simple_owner_a');
select lives_ok(
  $$ select public.simple_create_store('Tienda Simple A','simple-a-test') $$,
  'owner A can create its Simple store'
);
create temporary table test_a as
select id from public.sites where slug='simple-a-test';

select tests.authenticate_as('simple_owner_b');
select lives_ok(
  $$ select public.simple_create_store('Tienda Simple B','simple-b-test') $$,
  'owner B can create its Simple store'
);
create temporary table test_b as
select id from public.sites where slug='simple-b-test';

select tests.authenticate_as('simple_owner_a');
select is(
  (select count(*)::integer from public.sites where id=(select id from test_a)),
  1,
  'owner A can read A site'
);
select is(
  (select count(*)::integer from public.sites where id=(select id from test_b)),
  0,
  'owner A cannot read B site'
);
select lives_ok(
  format(
    $$ select public.simple_upsert_category(%L::uuid,'{"name":"Categoría A"}'::jsonb) $$,
    (select id from test_a)
  ),
  'owner A can create a category in A'
);

select lives_ok(
  format(
    $$ select public.simple_upsert_product(%L::uuid,jsonb_build_object(
      'name','Producto A','price',1000,'active',true,
      'category_id',(select id::text from public.product_categories where site_id=%L::uuid limit 1),
      'variants',jsonb_build_array(jsonb_build_object('name','Talle: M'))
    )) $$,
    (select id from test_a),(select id from test_a)
  ),
  'owner A can create a product and variant in A'
);

set local role service_role;
create temporary table test_order_a as
with inserted as (
  insert into public.orders(site_id,order_number,customer_name,customer_phone,total)
  values((select id from test_a),987654321,'Cliente A','1122334455',1000)
  returning id
)
select id from inserted;
set local role authenticated;
select tests.authenticate_as('simple_owner_a');
select throws_ok(
  format(
    $$ select public.simple_upsert_category(%L::uuid,'{"name":"Intrusión"}'::jsonb) $$,
    (select id from test_b)
  ),
  'SITE_ACCESS_DENIED',
  'owner A cannot create categories in B'
);

select tests.authenticate_as('simple_owner_b');
select is(
  (select count(*)::integer from public.product_categories where site_id=(select id from test_a)),
  0,
  'owner B cannot read A categories'
);

select is(
  (select count(*)::integer from public.products where site_id=(select id from test_a)),
  0,
  'owner B cannot read A products'
);
select is(
  (with changed as (
    update public.products set name='Intrusión'
    where site_id=(select id from test_a)
    returning id
  ) select count(*)::integer from changed),
  0,
  'owner B cannot modify A products'
);
select is(
  (select count(*)::integer from public.orders where id=(select id from test_order_a)),
  0,
  'owner B cannot read A orders'
);
select throws_ok(
  format($$ select public.platform_update_order_status(%L::uuid,'preparing') $$,(select id from test_order_a)),
  'SITE_ACCESS_DENIED',
  'owner B cannot change A order status'
);
select throws_ok(
  format($$ select public.simple_dashboard(%L::uuid) $$,(select id from test_a)),
  'SITE_ACCESS_DENIED',
  'owner B cannot read A dashboard'
);

select tests.authenticate_as('simple_outsider');
select is(
  (select count(*)::integer from public.sites where id in ((select id from test_a),(select id from test_b))),
  0,
  'unassigned user cannot read either site'
);
select throws_ok(
  format($$ select public.simple_complete_onboarding(%L::uuid) $$,(select id from test_a)),
  'SITE_ACCESS_DENIED',
  'unassigned user cannot complete another tenant onboarding'
);

select * from finish();
rollback;
