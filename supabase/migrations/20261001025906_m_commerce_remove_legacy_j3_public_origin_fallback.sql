alter table public.platform_domain_settings
  alter column public_origin set default 'https://m-commerce-ar.vercel.app'::text;

update public.platform_domain_settings
set public_origin = 'https://m-commerce-ar.vercel.app', updated_at = now()
where id = 1 and (public_origin is null or btrim(public_origin) = '' or public_origin ilike '%j3-plataform%');

create or replace function public.platform_public_origin()
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(
    nullif(trim((select public_origin from public.platform_domain_settings where id=1)),''),
    'https://m-commerce-ar.vercel.app'
  );
$function$;
