begin;

-- Separate RPC: retain the existing Simple contract and its tier restriction.
create or replace function public.platform_save_seller(p_site_id uuid,p_payload jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_seller jsonb:='{}'; v_policies jsonb:='{}'; k text;
begin
 if not public.platform_is_site_member(p_site_id) then raise exception 'SITE_ACCESS_DENIED'; end if;
 if jsonb_typeof(p_payload->'seller') is distinct from 'object' or jsonb_typeof(p_payload->'policies') is distinct from 'object' then raise exception 'INVALID_SELLER_CONFIGURATION'; end if;
 foreach k in array array['legal_name','cuit','address','email','phone','support_hours'] loop
  v_seller:=v_seller||jsonb_build_object(k,left(trim(coalesce(p_payload->'seller'->>k,'')),500));
 end loop;
 foreach k in array array['changes','returns','shipping','delivery_times'] loop
  v_policies:=v_policies||jsonb_build_object(k,left(trim(coalesce(p_payload->'policies'->>k,'')),5000));
 end loop;
 if v_seller->>'email'<>'' and v_seller->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'INVALID_EMAIL'; end if;
 if v_seller->>'cuit'<>'' and regexp_replace(v_seller->>'cuit','[^0-9]','','g') !~ '^[0-9]{11}$' then raise exception 'INVALID_CUIT'; end if;
 update public.settings set seller_information=v_seller,seller_policies=v_policies,updated_at=now() where site_id=p_site_id;
 if not found then raise exception 'SELLER_SETTINGS_NOT_FOUND'; end if;
 return true;
end $$;

create or replace function public.platform_seller_configuration(p_site_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.platform_is_site_member(p_site_id) then raise exception 'SITE_ACCESS_DENIED'; end if;
 select jsonb_build_object('seller',seller_information,'policies',seller_policies) into result from public.settings where site_id=p_site_id;
 if result is null then raise exception 'SELLER_SETTINGS_NOT_FOUND'; end if;
 return result;
end $$;
revoke all on function public.platform_save_seller(uuid,jsonb),public.platform_seller_configuration(uuid) from public,anon;
grant execute on function public.platform_save_seller(uuid,jsonb),public.platform_seller_configuration(uuid) to authenticated;

-- Fail closed when the shared runtime contract differs; never replace the whole function.
do $patch$
declare definition text; anchor text:=$anchor$'business_name',st.business_name,$anchor$;
begin
 select pg_get_functiondef('public.platform_get_storefront(text)'::regprocedure) into definition;
 if strpos(definition,$field$'seller_information'$field$)>0 then raise exception 'STOREFRONT_SELLER_PROJECTION_ALREADY_PRESENT'; end if;
 if strpos(definition,anchor)=0 then raise exception 'STOREFRONT_CONTRACT_REVIEW_REQUIRED'; end if;
 execute replace(definition,anchor,$fields$'seller_information',st.seller_information,'seller_policies',st.seller_policies,$fields$||anchor);
end $patch$;

create or replace function public.simple_capabilities() returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('catalog_legal',true,'platform_request_management',true,'seller_policies_all_plans',true,'schema_version','20261007030000');
$$;
revoke all on function public.simple_capabilities() from public;
grant execute on function public.simple_capabilities() to anon,authenticated;
commit;
