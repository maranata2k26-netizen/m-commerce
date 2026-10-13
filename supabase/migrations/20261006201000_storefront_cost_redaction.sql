-- One-field privacy fix to the verified shared public storefront definition.
-- Stop if the expected contract changed. Validate PRO and SIMPLE in staging first.
begin;
do $$
declare v_definition text;
begin
 select pg_get_functiondef('public.platform_get_storefront(text)'::regprocedure) into v_definition;
 if position('to_jsonb(p)||jsonb_build_object' in v_definition)=0 then
  raise exception 'STOREFRONT_DEFINITION_CHANGED_REAUDIT';
 end if;
 execute replace(v_definition,'to_jsonb(p)||jsonb_build_object','(to_jsonb(p) - ''cost_price'')||jsonb_build_object');
end $$;
commit;
