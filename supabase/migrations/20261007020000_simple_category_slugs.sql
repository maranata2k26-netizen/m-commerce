-- Distinct category IDs/slugs for repeated names and archived category replacements.
-- Existing rows, slugs and shared UNIQUE constraint are preserved.
begin;
create or replace function public.simple_upsert_category(p_site_id uuid,p_category jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.product_categories; v_id uuid; v_parent uuid; v_name text:=trim(p_category->>'name'); v_base_slug text; v_slug text; v_suffix int:=1; v_constraint text;
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
  v_base_slug:=public.simple_slugify(coalesce(nullif(p_category->>'slug',''),case when v_parent is not null then (select slug from public.product_categories where id=v_parent and site_id=p_site_id)||'-'||v_name else v_name end));
  v_slug:=v_base_slug;
  loop
   begin
    insert into public.product_categories(site_id,name,slug,parent_id,sort_order,active)
    values(p_site_id,v_name,v_slug,v_parent,coalesce((p_category->>'sort_order')::int,0),coalesce((p_category->>'active')::boolean,true)) returning * into v;
    exit;
   exception when unique_violation then
    get stacked diagnostics v_constraint=CONSTRAINT_NAME;
    if v_constraint<>'product_categories_site_id_slug_key' or nullif(p_category->>'slug','') is not null then raise; end if;
   end;
   v_suffix:=v_suffix+1;
   v_slug:=v_base_slug||'-'||v_suffix::text;
  end loop;
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

commit;
