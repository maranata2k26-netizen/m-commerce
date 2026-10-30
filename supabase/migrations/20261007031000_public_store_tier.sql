begin;
-- Public plan identifier supports correct legal navigation; no private fields added.
do $patch$
declare definition text; anchor text:=$anchor$'id',s.id,'name',s.name,'slug',s.slug,$anchor$;
begin
 select pg_get_functiondef('public.platform_get_storefront(text)'::regprocedure) into definition;
 if strpos(definition,$field$'product_tier'$field$)>0 then raise exception 'PUBLIC_STORE_TIER_ALREADY_PRESENT';end if;
 if strpos(definition,anchor)=0 then raise exception 'STOREFRONT_CONTRACT_REVIEW_REQUIRED';end if;
 execute replace(definition,anchor,anchor||$fields$'product_tier',s.product_tier,$fields$);
end $patch$;
commit;
