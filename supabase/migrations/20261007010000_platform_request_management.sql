-- Service requests without a store belong to the platform operator.
-- Existing tenant request updates retain their authorization and API shape.
begin;
create or replace function public.simple_update_consumer_request(p_site_id uuid,p_request_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_site_id is null then
  if not public.platform_is_master_admin() then raise exception 'SITE_ACCESS_DENIED'; end if;
 elsif not public.platform_is_site_member(p_site_id) then raise exception 'SITE_ACCESS_DENIED';
 end if;
 if p_status is null or p_status not in ('new','reviewing','resolved') then raise exception 'INVALID_STATUS'; end if;
 update public.simple_consumer_requests set status=p_status,resolved_at=case when p_status='resolved' then now() else null end
 where id=p_request_id and site_id is not distinct from p_site_id;
 if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
 perform public.platform_audit(p_site_id,'consumer_request_status_changed','consumer_request',p_request_id::text,jsonb_build_object('status',p_status));
 return true;
end $$;
revoke all on function public.simple_update_consumer_request(uuid,uuid,text) from public,anon;
grant execute on function public.simple_update_consumer_request(uuid,uuid,text) to authenticated;
create or replace function public.simple_capabilities() returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('catalog_legal',true,'platform_request_management',true,'schema_version','20261007010000');
$$;
revoke all on function public.simple_capabilities() from public;
grant execute on function public.simple_capabilities() to anon,authenticated;
commit;
