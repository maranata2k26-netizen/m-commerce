-- Apply first in an isolated staging database. No rows are deleted.
-- Shared payment/stock engines and PRO contracts remain unchanged.
begin;
alter table public.product_categories add column if not exists parent_id uuid,
  add column if not exists archived_at timestamptz;
alter table public.product_categories add constraint simple_category_parent_same_site
  foreign key(parent_id,site_id) references public.product_categories(id,site_id);
create index if not exists simple_category_parent_idx on public.product_categories(site_id,parent_id);

create or replace function public.simple_category_tree_guard() returns trigger language plpgsql
set search_path='' as $$
begin
 if new.parent_id is not null then
  if new.parent_id=new.id or exists(with recursive ancestors as (
    select id,parent_id from public.product_categories where id=new.parent_id and site_id=new.site_id
    union select c.id,c.parent_id from public.product_categories c join ancestors a on c.id=a.parent_id where c.site_id=new.site_id
  ) select 1 from ancestors where id=new.id) then raise exception 'CATEGORY_CYCLE'; end if;
 end if;
 return new;
end $$;
create trigger simple_category_tree_guard before insert or update of parent_id,site_id
 on public.product_categories for each row execute function public.simple_category_tree_guard();

create or replace function public.simple_upsert_category(p_site_id uuid,p_category jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.product_categories; v_id uuid; v_parent uuid; v_name text:=trim(p_category->>'name');
begin
 if not public.platform_is_site_member(p_site_id) then raise exception 'SITE_ACCESS_DENIED'; end if;
 if not exists(select 1 from public.sites where id=p_site_id and product_tier='simple') then raise exception 'SIMPLE_SITE_REQUIRED'; end if;
 if v_name is null or length(v_name) not between 1 and 80 then raise exception 'INVALID_CATEGORY_NAME'; end if;
 v_id:=nullif(p_category->>'id','')::uuid;
 if v_id is not null then
  select * into v from public.product_categories where id=v_id and site_id=p_site_id for update;
  if not found then raise exception 'CATEGORY_NOT_FOUND'; end if;
 end if;
 v_parent:=case when p_category ? 'parent_id' then nullif(p_category->>'parent_id','')::uuid else v.parent_id end;
 if v_parent is not null and not exists(select 1 from public.product_categories where id=v_parent and site_id=p_site_id and archived_at is null) then raise exception 'CATEGORY_PARENT_NOT_FOUND'; end if;
 if v_id is null then
  insert into public.product_categories(site_id,name,slug,parent_id,sort_order,active)
  values(p_site_id,v_name,public.simple_slugify(coalesce(nullif(p_category->>'slug',''),v_name)),v_parent,coalesce((p_category->>'sort_order')::int,0),coalesce((p_category->>'active')::boolean,true)) returning * into v;
 else
  update public.product_categories set name=v_name,parent_id=v_parent,
    slug=case when p_category ? 'slug' then public.simple_slugify(p_category->>'slug') else slug end,
    active=coalesce((p_category->>'active')::boolean,active),sort_order=coalesce((p_category->>'sort_order')::int,sort_order),
    archived_at=case when (p_category->>'restore')::boolean then null else archived_at end,updated_at=now()
  where id=v_id and site_id=p_site_id returning * into v;
  update public.products set category=v_name where site_id=p_site_id and category_id=v_id;
 end if;
 perform public.platform_audit(p_site_id,'simple_category_saved','category',v.id::text,jsonb_build_object('name',v.name));
 return to_jsonb(v);
end $$;

create or replace function public.simple_delete_category(p_site_id uuid,p_category_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.platform_is_site_member(p_site_id) then raise exception 'SITE_ACCESS_DENIED'; end if;
 if exists(select 1 from public.product_categories where parent_id=p_category_id and site_id=p_site_id and archived_at is null) then raise exception 'CATEGORY_HAS_CHILDREN'; end if;
 if exists(select 1 from public.products where site_id=p_site_id and category_id=p_category_id) then raise exception 'CATEGORY_NOT_EMPTY'; end if;
 update public.product_categories set active=false,archived_at=now(),updated_at=now() where id=p_category_id and site_id=p_site_id;
 if not found then raise exception 'CATEGORY_NOT_FOUND'; end if;
 return jsonb_build_object('deleted',true,'archived',true,'id',p_category_id);
end $$;

create or replace function public.simple_seed_categories(p_site_id uuid,p_names jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_name text;
begin
 if not public.platform_is_site_member(p_site_id) then raise exception 'SITE_ACCESS_DENIED'; end if;
 if not exists(select 1 from public.sites where id=p_site_id and product_tier='simple') then raise exception 'SIMPLE_SITE_REQUIRED'; end if;
 if jsonb_typeof(p_names)<>'array' then raise exception 'INVALID_CATEGORIES'; end if;
 for v_name in select jsonb_array_elements_text(p_names) loop
  if length(trim(v_name)) not between 1 and 80 then raise exception 'INVALID_CATEGORY_NAME'; end if;
  insert into public.product_categories(site_id,name,slug) values(p_site_id,trim(v_name),public.simple_slugify(v_name)) on conflict(site_id,slug) do nothing;
 end loop;
 return true;
end $$;

-- Stable variant IDs are essential for existing order snapshots and stock restoration.
create or replace function public.simple_upsert_product(p_site_id uuid,p_product jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result public.products; v_saved jsonb; v_previous public.products;
 v_category uuid; v_name text; v_variant jsonb; v_id uuid; v_old public.product_variants;
 v_ids uuid[]:='{}'; v_tracking boolean; v_stock int; v_delta numeric;
begin
 if not public.platform_is_site_member(p_site_id) then raise exception 'SITE_ACCESS_DENIED'; end if;
 if not exists(select 1 from public.sites where id=p_site_id and product_tier='simple') then raise exception 'SIMPLE_SITE_REQUIRED'; end if;
 if nullif(p_product->>'id','') is not null then
  select * into v_previous from public.products where id=(p_product->>'id')::uuid and site_id=p_site_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
 end if;
 v_category:=case when p_product ? 'category_id' then nullif(p_product->>'category_id','')::uuid else v_previous.category_id end;
 if v_category is not null then
  select name into v_name from public.product_categories where id=v_category and site_id=p_site_id and archived_at is null;
  if v_name is null then raise exception 'CATEGORY_NOT_FOUND'; end if;
 else v_name:=coalesce(nullif(trim(p_product->>'category'),''),v_previous.category,'Productos'); end if;
 if p_product ? 'variants' and (jsonb_typeof(p_product->'variants')<>'array' or jsonb_array_length(p_product->'variants')>50) then raise exception 'INVALID_VARIANTS'; end if;
 if v_previous.stock_tracking and p_product ? 'expected_stock_quantity' and nullif(p_product->>'expected_stock_quantity','')::int is distinct from v_previous.stock_quantity then raise exception 'STOCK_CHANGED_RELOAD'; end if;
 v_saved:=public.platform_upsert_product(p_site_id,coalesce(to_jsonb(v_previous),'{}')||p_product||jsonb_build_object('category',v_name));
 update public.products set category_id=v_category,
   stock_tracking=case when jsonb_typeof(p_product->'variants')='array' and jsonb_array_length(p_product->'variants')>0 then false else stock_tracking end
 where id=(v_saved->>'id')::uuid and site_id=p_site_id returning * into v_result;
 if p_product ? 'variants' then
  for v_variant in select value from jsonb_array_elements(p_product->'variants') loop
   v_id:=nullif(v_variant->>'id','')::uuid; v_old:=null;
   if v_id is not null then
    select * into v_old from public.product_variants where id=v_id and site_id=p_site_id and product_id=v_result.id for update;
    if not found then raise exception 'VARIANT_NOT_FOUND'; end if;
   else
    select * into v_old from public.product_variants where site_id=p_site_id and product_id=v_result.id and active and name=trim(v_variant->>'name') and not(id=any(v_ids)) order by created_at limit 1 for update;
    v_id:=v_old.id;
   end if;
   if v_id=any(v_ids) then raise exception 'DUPLICATE_VARIANT'; end if;
   if length(trim(coalesce(v_variant->>'name',''))) not between 1 and 100 then raise exception 'INVALID_VARIANT_NAME'; end if;
   if jsonb_typeof(coalesce(v_variant->'attributes','{}'))<>'object' then raise exception 'INVALID_VARIANT_ATTRIBUTES'; end if;
   v_tracking:=coalesce((v_variant->>'stock_tracking')::boolean,v_old.stock_tracking,false);
   v_stock:=case when v_variant ? 'stock_quantity' then nullif(v_variant->>'stock_quantity','')::int else v_old.stock_quantity end;
   if v_tracking and (v_stock is null or v_stock<0) then raise exception 'INVALID_VARIANT_STOCK'; end if;
   if v_old.stock_tracking and v_variant ? 'expected_stock_quantity' and nullif(v_variant->>'expected_stock_quantity','')::int is distinct from v_old.stock_quantity then raise exception 'STOCK_CHANGED_RELOAD'; end if;
   v_delta:=coalesce((v_variant->>'price_delta')::numeric,v_old.price_delta,0);
   if v_delta+v_result.price<0 then raise exception 'INVALID_VARIANT_PRICE'; end if;
   if v_id is null then
    insert into public.product_variants(site_id,product_id,name,price_delta,stock_tracking,stock_quantity,available,sku,attributes,sort_order)
    values(p_site_id,v_result.id,trim(v_variant->>'name'),v_delta,v_tracking,v_stock,
      coalesce((v_variant->>'available')::boolean,true) and (not v_tracking or v_stock>0),
      nullif(left(trim(v_variant->>'sku'),80),''),coalesce(v_variant->'attributes','{}'),coalesce((v_variant->>'sort_order')::int,0)) returning id into v_id;
   else
    update public.product_variants set name=trim(v_variant->>'name'),price_delta=v_delta,active=true,stock_tracking=v_tracking,stock_quantity=v_stock,
      available=coalesce((v_variant->>'available')::boolean,v_old.available) and (not v_tracking or v_stock>0),
      sku=case when v_variant ? 'sku' then nullif(left(trim(v_variant->>'sku'),80),'') else sku end,
      attributes=coalesce(v_variant->'attributes',attributes),sort_order=coalesce((v_variant->>'sort_order')::int,sort_order),updated_at=now()
    where id=v_id and site_id=p_site_id and product_id=v_result.id;
   end if;
   v_ids:=array_append(v_ids,v_id);
  end loop;
  update public.product_variants set active=false,updated_at=now() where site_id=p_site_id and product_id=v_result.id and not(id=any(v_ids));
 end if;
 update public.sites set last_activity_at=now(),updated_at=now() where id=p_site_id;
 return to_jsonb(v_result);
end $$;

-- Explicit configuration for seller-owned disclosures; never populate legal identity from platform identity.
alter table public.settings add column if not exists seller_information jsonb not null default '{}',
 add column if not exists seller_policies jsonb not null default '{}',
 add column if not exists out_of_stock_action text not null default 'hide';
alter table public.settings add constraint simple_stock_action_check check(out_of_stock_action in ('show','hide','contact'));
create or replace function public.simple_save_seller(p_site_id uuid,p_payload jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_seller jsonb:='{}'; v_policies jsonb:='{}'; k text; v_action text;
begin
 if not public.platform_is_site_member(p_site_id) then raise exception 'SITE_ACCESS_DENIED'; end if;
 if not exists(select 1 from public.sites where id=p_site_id and product_tier='simple') then raise exception 'SIMPLE_SITE_REQUIRED'; end if;
 foreach k in array array['legal_name','cuit','address','email','phone','support_hours'] loop
  v_seller:=v_seller||jsonb_build_object(k,left(trim(coalesce(p_payload->'seller'->>k,'')),500));
 end loop;
 foreach k in array array['changes','returns','shipping','delivery_times'] loop
  v_policies:=v_policies||jsonb_build_object(k,left(trim(coalesce(p_payload->'policies'->>k,'')),5000));
 end loop;
 if v_seller->>'email'<>'' and v_seller->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'INVALID_EMAIL'; end if;
 if v_seller->>'cuit'<>'' and regexp_replace(v_seller->>'cuit','[^0-9]','','g') !~ '^[0-9]{11}$' then raise exception 'INVALID_CUIT'; end if;
 v_action:=coalesce(p_payload->>'out_of_stock_action','hide');
 if v_action not in ('show','hide','contact') then raise exception 'INVALID_STOCK_ACTION'; end if;
 update public.settings set seller_information=v_seller,seller_policies=v_policies,out_of_stock_action=v_action,updated_at=now() where site_id=p_site_id;
 return true;
end $$;

-- Keep the original storefront function as dependency; redact internal fields in SIMPLE only.
create or replace function public.simple_catalog_payload(p_site_id uuid,p_store jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_products jsonb; v_variants jsonb; v_categories jsonb; st public.settings;
begin
 select * into st from public.settings where site_id=p_site_id;
 with recursive visible as (
  select id from public.product_categories where site_id=p_site_id and parent_id is null and active and archived_at is null
  union all select c.id from public.product_categories c join visible v on c.parent_id=v.id where c.site_id=p_site_id and c.active and c.archived_at is null
 ) select coalesce(jsonb_agg(to_jsonb(c) order by sort_order,name),'[]') into v_categories from public.product_categories c where id in(select id from visible);
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'product_id',v.product_id,'name',v.name,'price_delta',v.price_delta,
   'active',v.active,'available',v.available and (not v.stock_tracking or coalesce(v.stock_quantity,0)>0),
   'stock_tracking',v.stock_tracking,'stock_quantity',v.stock_quantity,'sku',v.sku,'attributes',v.attributes,'sort_order',v.sort_order) order by v.sort_order),'[]')
 into v_variants from public.product_variants v where v.site_id=p_site_id and v.active;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'description',p.description,'price',p.price,'compare_price',p.compare_price,
   'image_url',p.image_url,'active',p.active,'category',p.category,'category_id',p.category_id,'sales_mode',p.sales_mode,
   'availability_status',p.availability_status,'stock_tracking',p.stock_tracking,'stock_quantity',p.stock_quantity,
   'attributes',jsonb_build_object('gallery',coalesce(p.attributes->'gallery','[]')),
   'effective_available',coalesce((original.item->>'effective_available')::boolean,false) and (
     not exists(select 1 from public.product_variants v where v.product_id=p.id and v.site_id=p_site_id and v.active)
     or exists(select 1 from public.product_variants v where v.product_id=p.id and v.site_id=p_site_id and v.active and v.available and (not v.stock_tracking or coalesce(v.stock_quantity,0)>0)))
 ) order by p.sort_order,p.created_at),'[]') into v_products
 from public.products p join lateral(select item from jsonb_array_elements(coalesce(p_store->'products','[]')) item where item->>'id'=p.id::text) original on true
 where p.site_id=p_site_id and p.active and (p.category_id is null or exists(select 1 from jsonb_array_elements(v_categories) c where c->>'id'=p.category_id::text));
 return p_store||jsonb_build_object('products',v_products,'variants',v_variants,'categories',v_categories,'settings',coalesce(p_store->'settings','{}')||jsonb_build_object(
  'seller_information',st.seller_information,'seller_policies',st.seller_policies,'out_of_stock_action',st.out_of_stock_action,'logo_url',st.logo_url,'cover_url',st.cover_url,'payment_methods',st.payment_methods));
end $$;
revoke all on function public.simple_catalog_payload(uuid,jsonb) from public,anon,authenticated;

create or replace function public.simple_public_storefront(p_slug text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_store jsonb;
begin
 select id into v_id from public.sites where lower(slug)=lower(trim(p_slug)) and product_tier='simple' and status='published' and not is_suspended and subscription_status in ('trial','active');
 if v_id is null then return null; end if;
 v_store:=public.platform_get_storefront(p_slug);
 return public.simple_catalog_payload(v_id,v_store)||jsonb_build_object('product_tier','simple');
end $$;
create or replace function public.simple_preview_storefront_v2(p_slug text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_store jsonb; v_id uuid;
begin
 select id into v_id from public.sites where lower(slug)=lower(trim(p_slug)) and product_tier='simple';
 if v_id is null then return null; end if;
 if not public.platform_is_site_member(v_id) then raise exception 'SITE_ACCESS_DENIED'; end if;
 v_store:=public.simple_preview_storefront(p_slug);
 return public.simple_catalog_payload(v_id,v_store);
end $$;
revoke all on function public.simple_preview_storefront_v2(text) from public,anon;
grant execute on function public.simple_preview_storefront_v2(text) to authenticated;

-- Request intake is service-only, with no anonymous read or order mutation.
create table public.simple_consumer_requests(
 id uuid primary key default gen_random_uuid(), site_id uuid references public.sites(id),
 request_code text not null unique default ('MC-'||replace(gen_random_uuid()::text,'-','')),
 kind text not null check(kind in ('withdrawal','complaint','service_cancellation','privacy','technical')),
 customer_name text not null, email text not null, phone text not null default '',
 order_reference text not null default '', message text not null default '',
 status text not null default 'new' check(status in ('new','reviewing','resolved')),
 created_at timestamptz not null default now(), resolved_at timestamptz
);
alter table public.simple_consumer_requests enable row level security;
revoke all on public.simple_consumer_requests from anon,authenticated;
grant select on public.simple_consumer_requests to authenticated;
grant select,insert,update on public.simple_consumer_requests to service_role;
create policy simple_request_owner_read on public.simple_consumer_requests for select to authenticated
 using(case when site_id is null then public.platform_is_master_admin() else public.platform_is_site_member(site_id) end);
create index simple_request_site_status_idx on public.simple_consumer_requests(site_id,status,created_at);

-- Versioned evidence is separate from the legacy single-active-contract flow.
create table public.simple_legal_documents(
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('terms','privacy','simple','cookies')),
 version text not null,content text not null,content_hash text not null, published boolean not null default false,
 created_at timestamptz not null default now(),unique(kind,version)
);
alter table public.simple_legal_documents enable row level security;
revoke all on public.simple_legal_documents from anon,authenticated;
grant select on public.simple_legal_documents to anon,authenticated;
create policy simple_published_documents on public.simple_legal_documents for select to anon,authenticated using(published);
create table public.simple_legal_acceptances(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),site_id uuid not null references public.sites(id),
 document_id uuid not null references public.simple_legal_documents(id), context text not null,
 action text not null check(action in ('acceptance','privacy_notice')),accepted_at timestamptz not null default now(),
 unique(user_id,site_id,document_id,context)
);
alter table public.simple_legal_acceptances enable row level security;
revoke all on public.simple_legal_acceptances from anon,authenticated;
grant select on public.simple_legal_acceptances to authenticated;
create policy simple_own_acceptances on public.simple_legal_acceptances for select to authenticated using(user_id=(select auth.uid()));
create table public.simple_checkout_disclosures(
 order_id uuid primary key references public.orders(id),site_id uuid not null references public.sites(id),
 seller_snapshot jsonb not null,policies_snapshot jsonb not null,privacy_document_id uuid references public.simple_legal_documents(id),
 recorded_at timestamptz not null default now()
);
alter table public.simple_checkout_disclosures enable row level security;
revoke all on public.simple_checkout_disclosures from anon,authenticated;
grant select on public.simple_checkout_disclosures to authenticated;
create policy simple_checkout_owner_read on public.simple_checkout_disclosures for select to authenticated using(public.platform_is_site_member(site_id));
grant select,insert on public.simple_checkout_disclosures to service_role;
create or replace function public.simple_checkout_snapshot() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.sites where id=new.site_id and product_tier='simple') then
  insert into public.simple_checkout_disclosures(order_id,site_id,seller_snapshot,policies_snapshot,privacy_document_id)
  select new.id,new.site_id,seller_information,seller_policies,(select id from public.simple_legal_documents where kind='privacy' and published order by created_at desc limit 1)
  from public.settings where site_id=new.site_id;
 end if;
 return new;
end $$;
create trigger simple_checkout_snapshot after insert on public.orders for each row execute function public.simple_checkout_snapshot();
revoke all on function public.simple_checkout_snapshot() from public,anon,authenticated;
grant select,insert,update on public.simple_legal_documents to service_role;
grant select,insert on public.simple_legal_acceptances to service_role;
create or replace function public.simple_legal_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if (old.published or exists(select 1 from public.simple_legal_acceptances where document_id=old.id)) and
  (new.content is distinct from old.content or new.content_hash is distinct from old.content_hash or new.version is distinct from old.version or new.kind is distinct from old.kind) then
  raise exception 'PUBLISHED_LEGAL_DOCUMENT_IMMUTABLE';
 end if;
 return new;
end $$;
create trigger simple_legal_immutable before update on public.simple_legal_documents for each row execute function public.simple_legal_immutable();
revoke all on function public.simple_legal_immutable() from public,anon,authenticated;
create or replace function public.simple_accept_documents(p_site_id uuid,p_document_ids uuid[],p_context text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.platform_is_site_member(p_site_id) then raise exception 'SITE_ACCESS_DENIED'; end if;
 if p_context not in ('merchant_onboarding','merchant_update') then raise exception 'INVALID_CONTEXT'; end if;
 if not exists(select 1 from public.sites where id=p_site_id and product_tier='simple') then raise exception 'SIMPLE_SITE_REQUIRED'; end if;
 foreach v_id in array p_document_ids loop
  if not exists(select 1 from public.simple_legal_documents where id=v_id and published) then raise exception 'DOCUMENT_NOT_PUBLISHED'; end if;
  insert into public.simple_legal_acceptances(user_id,site_id,document_id,context,action)
  select auth.uid(),p_site_id,id,p_context,case when kind='privacy' then 'privacy_notice' else 'acceptance' end from public.simple_legal_documents where id=v_id on conflict do nothing;
 end loop;
 return true;
end $$;

revoke all on function public.simple_seed_categories(uuid,jsonb),public.simple_save_seller(uuid,jsonb),public.simple_accept_documents(uuid,uuid[],text) from public,anon;
grant execute on function public.simple_seed_categories(uuid,jsonb),public.simple_save_seller(uuid,jsonb),public.simple_accept_documents(uuid,uuid[],text) to authenticated;
revoke all on function public.simple_category_tree_guard() from public,anon,authenticated;

create or replace function public.simple_reorder_categories(p_site_id uuid,p_ids uuid[])
returns boolean language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_parent uuid; v_count int;
begin
 if not public.platform_is_site_member(p_site_id) then raise exception 'SITE_ACCESS_DENIED'; end if;
 if not exists(select 1 from public.sites where id=p_site_id and product_tier='simple') then raise exception 'SIMPLE_SITE_REQUIRED'; end if;
 select count(*) into v_count from public.product_categories where site_id=p_site_id and id=any(p_ids);
 if v_count<>cardinality(p_ids) then raise exception 'CATEGORY_NOT_FOUND'; end if;
 select parent_id into v_parent from public.product_categories where id=p_ids[1] and site_id=p_site_id;
 if exists(select 1 from public.product_categories where id=any(p_ids) and parent_id is distinct from v_parent) then raise exception 'CATEGORY_PARENT_MISMATCH'; end if;
 update public.product_categories c set sort_order=x.position,updated_at=now()
 from unnest(p_ids) with ordinality x(id,position) where c.id=x.id and c.site_id=p_site_id;
 return true;
end $$;
create or replace function public.simple_operations_summary(p_site_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_customers jsonb; v_stock jsonb;
begin
 if not public.platform_is_site_member(p_site_id) then raise exception 'SITE_ACCESS_DENIED'; end if;
 if not exists(select 1 from public.sites where id=p_site_id and product_tier='simple') then raise exception 'SIMPLE_SITE_REQUIRED'; end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_customers from (
  select customer_phone phone,max(customer_name) name,max(customer_email) email,count(*) orders
  from public.orders where site_id=p_site_id group by customer_phone order by max(created_at) desc
 ) x;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_stock from (
  select p.name,null::text variant,coalesce(p.stock_quantity,0) quantity from public.products p
  where p.site_id=p_site_id and p.active and p.stock_tracking
  union all select p.name,v.name,coalesce(v.stock_quantity,0) from public.product_variants v join public.products p on p.id=v.product_id and p.site_id=v.site_id
  where v.site_id=p_site_id and v.active and v.stock_tracking
 ) x;
 return jsonb_build_object('customers',v_customers,'stock',v_stock,'counts',jsonb_build_object(
  'published_products',(select count(*) from public.products where site_id=p_site_id and active),
  'out_of_stock',(select count(*) from public.products where site_id=p_site_id and active and stock_tracking and coalesce(stock_quantity,0)=0)
    +(select count(*) from public.product_variants where site_id=p_site_id and active and stock_tracking and coalesce(stock_quantity,0)=0)
  ));
end $$;
create or replace function public.simple_update_consumer_request(p_site_id uuid,p_request_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not public.platform_is_site_member(p_site_id) then raise exception 'SITE_ACCESS_DENIED'; end if;
 if p_status not in ('new','reviewing','resolved') then raise exception 'INVALID_STATUS'; end if;
 update public.simple_consumer_requests set status=p_status,resolved_at=case when p_status='resolved' then now() else null end
 where id=p_request_id and site_id=p_site_id;
 if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
 return true;
end $$;
create or replace function public.simple_order_category_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare v_category uuid;
begin
 if not exists(select 1 from public.sites where id=new.site_id and product_tier='simple') then return new; end if;
 select category_id into v_category from public.products where id=new.product_id and site_id=new.site_id;
 if v_category is not null and exists(with recursive ancestors as (
   select id,parent_id,active,archived_at from public.product_categories where id=v_category and site_id=new.site_id
   union select c.id,c.parent_id,c.active,c.archived_at from public.product_categories c join ancestors a on c.id=a.parent_id where c.site_id=new.site_id
 ) select 1 from ancestors where not active or archived_at is not null) then raise exception 'CATEGORY_NOT_AVAILABLE'; end if;
 return new;
end $$;
create trigger simple_order_category_guard before insert on public.order_items for each row execute function public.simple_order_category_guard();
revoke all on function public.simple_reorder_categories(uuid,uuid[]),public.simple_operations_summary(uuid),public.simple_update_consumer_request(uuid,uuid,text),public.simple_order_category_guard() from public,anon;
grant execute on function public.simple_reorder_categories(uuid,uuid[]),public.simple_operations_summary(uuid),public.simple_update_consumer_request(uuid,uuid,text) to authenticated;
create or replace function public.simple_capabilities() returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('catalog_legal',true,'schema_version','20261006200000');
$$;
revoke all on function public.simple_capabilities() from public;
grant execute on function public.simple_capabilities() to anon,authenticated;
commit;
