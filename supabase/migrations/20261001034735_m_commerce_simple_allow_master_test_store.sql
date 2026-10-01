create or replace function public.platform_prevent_master_membership()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
begin
  if new.user_id is not null and exists (
    select 1 from public.profiles p where p.id = new.user_id and p.role = 'admin'
  ) and not exists (
    select 1 from public.sites s
    where s.id = new.site_id
      and s.product_tier = 'simple'
  ) then
    raise exception 'MASTER_CANNOT_BE_MERCHANT';
  end if;
  new.email := lower(trim(new.email));
  return new;
end;
$function$;

comment on function public.platform_prevent_master_membership() is
'Prevents master/admin accounts from becoming merchants on PRO/regular sites while allowing isolated M Commerce Simple self-service test stores.';
