-- Item 10: secure notification inbox contract (STAGING only, no lasting data).
BEGIN;
SELECT set_config('mc10.member',
 (SELECT m.user_id::text FROM public.site_memberships m JOIN public.sites s ON s.id=m.site_id
  WHERE s.product_tier='simple' AND m.status='active' LIMIT 1),true) IS NOT NULL AS merchant_fixture;
SELECT set_config('mc10.owned',
 (SELECT m.site_id::text FROM public.site_memberships m JOIN public.sites s ON s.id=m.site_id
  WHERE s.product_tier='simple' AND m.status='active'
  AND m.user_id=current_setting('mc10.member',true)::uuid LIMIT 1),true) IS NOT NULL AS owned_fixture;
SELECT set_config('mc10.foreign',
 (SELECT s.id::text FROM public.sites s
  WHERE s.product_tier='simple' AND s.id<>current_setting('mc10.owned',true)::uuid LIMIT 1),true) IS NOT NULL AS foreign_fixture;

WITH sample AS (
 INSERT INTO public.simple_notifications(site_id,event_key,kind,title,message)
 VALUES (current_setting('mc10.owned')::uuid,'item10:test:own','order','Pedido QA','No se envían correos reales')
 RETURNING id
)
SELECT set_config('mc10.notification',(SELECT id::text FROM sample),true) IS NOT NULL AS notification_created;

WITH sample AS (
 INSERT INTO public.simple_notifications(site_id,event_key,kind,title,message)
 VALUES (current_setting('mc10.foreign')::uuid,'item10:test:foreign','payment','Pago QA','Aislado de otras tiendas')
 RETURNING id
)
SELECT set_config('mc10.foreign_notification',(SELECT id::text FROM sample),true) IS NOT NULL AS foreign_created;

-- Same event can be replayed, but unique key guarantees only one inbox record.
INSERT INTO public.simple_notifications(site_id,event_key,kind,title,message)
VALUES(current_setting('mc10.owned')::uuid,'item10:test:own','order','Duplicado','No debe duplicarse')
ON CONFLICT(site_id,event_key) DO NOTHING;

SELECT set_config('request.jwt.claim.sub',current_setting('mc10.member'),true) IS NOT NULL AS jwt_ready;
SET LOCAL ROLE authenticated;
DO $test$
DECLARE
  v_owner uuid:=current_setting('mc10.owned')::uuid;
  v_foreign uuid:=current_setting('mc10.foreign')::uuid;
  v_id uuid:=current_setting('mc10.notification')::uuid;
  v_foreign_id uuid:=current_setting('mc10.foreign_notification')::uuid;
  v_notifications jsonb;
  v_saved jsonb;
BEGIN
  IF has_table_privilege('authenticated','public.simple_notifications','SELECT') THEN
    RAISE EXCEPTION 'DIRECT_INBOX_LEAK';
  END IF;
  IF has_function_privilege('anon','public.simple_my_notifications(uuid,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'ANONYMOUS_CAN_READ_INBOX';
  END IF;
  IF has_function_privilege('anon','public.simple_mark_notification_read(uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'ANONYMOUS_CAN_MARK_INBOX';
  END IF;

  v_notifications:=public.simple_my_notifications(v_owner,50);
  IF jsonb_array_length(v_notifications)<>1 THEN
    RAISE EXCEPTION 'UNEXPECTED_NOTIFICATION_COUNT';
  END IF;
  IF v_notifications->0->>'title'<>'Pedido QA' OR v_notifications->0->>'read_at' IS NOT NULL THEN
    RAISE EXCEPTION 'NOTIFICATION_CONTENT_MISMATCH';
  END IF;

  BEGIN
    PERFORM public.simple_my_notifications(v_foreign,50);
    RAISE EXCEPTION 'FOREIGN_INBOX_EXPOSED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'SITE_ACCESS_DENIED' THEN RAISE; END IF;
  END;

  v_saved:=public.simple_mark_notification_read(v_owner,v_id);
  IF v_saved->>'id'<>v_id::text OR v_saved->>'read_at' IS NULL THEN
    RAISE EXCEPTION 'READ_UPDATE_FAILED';
  END IF;
  IF public.simple_my_notifications(v_owner,50)->0->>'read_at' IS NULL THEN
    RAISE EXCEPTION 'READ_STATE_NOT_PERSISTED';
  END IF;

  BEGIN
    PERFORM public.simple_mark_notification_read(v_owner,v_foreign_id);
    RAISE EXCEPTION 'FOREIGN_NOTIFICATION_MODIFIED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'NOTIFICATION_NOT_FOUND' THEN RAISE; END IF;
  END;
END $test$;
ROLLBACK;
