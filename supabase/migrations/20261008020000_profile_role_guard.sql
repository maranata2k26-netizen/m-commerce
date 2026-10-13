-- Restrict privileged profile roles without changing existing profile fields or policies.
begin;
create or replace function public.platform_guard_profile_role()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (tg_op='INSERT' and new.role='admin') or (tg_op='UPDATE' and new.role is distinct from old.role) then
  if coalesce(auth.role(),'')<>'service_role' and not (
   coalesce(auth.role(),'')='' and session_user in ('postgres','supabase_admin')
  ) then raise exception 'PROFILE_ROLE_CHANGE_FORBIDDEN' using errcode='42501';end if;
 end if;
 return new;
end;
$$;
revoke all on function public.platform_guard_profile_role() from public,anon,authenticated;
create trigger profiles_guard_privileged_role
before insert or update of role on public.profiles
for each row execute function public.platform_guard_profile_role();
commit;
