-- Private Simple RPCs must require a signed-in user. Revoke PUBLIC because new functions inherit EXECUTE for PUBLIC by default.
revoke execute on function public.simple_admin_set_store_state(uuid,text) from public, anon;
revoke execute on function public.simple_complete_onboarding(uuid) from public, anon;
revoke execute on function public.simple_create_store(text,text) from public, anon;
revoke execute on function public.simple_dashboard(uuid) from public, anon;
revoke execute on function public.simple_ensure_store() from public, anon;
revoke execute on function public.simple_master_pro_leads() from public, anon;
revoke execute on function public.simple_master_stores() from public, anon;
revoke execute on function public.simple_mercadopago_status(uuid) from public, anon;
revoke execute on function public.simple_my_store() from public, anon;
revoke execute on function public.simple_preview_storefront(text) from public, anon;
revoke execute on function public.simple_publish_store(uuid) from public, anon;
revoke execute on function public.simple_save_store_profile(uuid,jsonb) from public, anon;
revoke execute on function public.simple_update_draft_identity(uuid,text) from public, anon;
revoke execute on function public.simple_upsert_category(uuid,jsonb) from public, anon;
revoke execute on function public.simple_upsert_product(uuid,jsonb) from public, anon;

-- These are the only Simple read RPCs intended for unauthenticated visitors.
revoke execute on function public.simple_public_plan() from public;
revoke execute on function public.simple_public_storefront(text) from public;
grant execute on function public.simple_public_plan() to anon, authenticated;
grant execute on function public.simple_public_storefront(text) to anon, authenticated;

-- Signed-in app surface.
grant execute on function public.simple_admin_set_store_state(uuid,text) to authenticated;
grant execute on function public.simple_complete_onboarding(uuid) to authenticated;
grant execute on function public.simple_create_store(text,text) to authenticated;
grant execute on function public.simple_dashboard(uuid) to authenticated;
grant execute on function public.simple_ensure_store() to authenticated;
grant execute on function public.simple_master_pro_leads() to authenticated;
grant execute on function public.simple_master_stores() to authenticated;
grant execute on function public.simple_mercadopago_status(uuid) to authenticated;
grant execute on function public.simple_my_store() to authenticated;
grant execute on function public.simple_preview_storefront(text) to authenticated;
grant execute on function public.simple_publish_store(uuid) to authenticated;
grant execute on function public.simple_save_store_profile(uuid,jsonb) to authenticated;
grant execute on function public.simple_update_draft_identity(uuid,text) to authenticated;
grant execute on function public.simple_upsert_category(uuid,jsonb) to authenticated;
grant execute on function public.simple_upsert_product(uuid,jsonb) to authenticated;
