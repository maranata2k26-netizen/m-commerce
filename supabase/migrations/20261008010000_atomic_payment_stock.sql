-- Atomic payment reconciliation. Preserves existing statuses and order records.
BEGIN;
CREATE OR REPLACE FUNCTION public.platform_apply_order_payment(
 p_site_id uuid,p_order_id uuid,p_payment_status text,p_payment_status_detail text,
 p_provider_payment_id text,p_paid_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE o public.orders; effective text; detail text; review boolean:=false;previous_payment text;previous_detail text;
BEGIN
 IF p_payment_status NOT IN ('pending','approved','rejected','cancelled','refunded') THEN RAISE EXCEPTION 'INVALID_PAYMENT_STATUS'; END IF;
 IF coalesce(p_provider_payment_id,'') !~ '^[0-9]{6,30}$' THEN RAISE EXCEPTION 'INVALID_PAYMENT_ID'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order_id AND site_id=p_site_id AND payment_method='mercadopago' FOR UPDATE;
 IF o.id IS NULL THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
 previous_payment:=o.payment_status;previous_detail:=o.payment_status_detail;effective:=p_payment_status;detail:=left(coalesce(p_payment_status_detail,p_payment_status),160);
 -- Provider retries must not downgrade a completed refund or an approved payment.
 IF o.payment_status='refunded' THEN effective:='refunded';detail:=o.payment_status_detail;
 ELSIF o.payment_status='approved' AND p_payment_status NOT IN ('approved','refunded') THEN effective:='approved';detail:=o.payment_status_detail;
 END IF;
 IF effective IN ('rejected','cancelled') AND o.status IN ('payment_pending','cancelled') AND NOT o.stock_restored THEN
  -- The stock and the payment/order update commit together or roll back together.
  PERFORM public.restore_order_stock_v47(o.id);
 END IF;
 IF effective='approved' AND (o.stock_restored OR o.status='cancelled') THEN
  -- A cancelled sale is never silently reopened after its inventory was released.
  review:=true;detail:='approved_after_cancellation_review_required';
 END IF;
 UPDATE public.orders SET payment_status=effective,
  payment_status_detail=detail,provider_payment_id=p_provider_payment_id,
  paid_at=CASE WHEN effective='approved' THEN coalesce(o.paid_at,p_paid_at,now()) ELSE o.paid_at END,
  status=CASE WHEN effective='approved' AND NOT review AND o.status IN ('payment_pending','new','paid') THEN 'paid'
              WHEN effective IN ('rejected','cancelled') AND o.status='payment_pending' THEN 'cancelled' ELSE o.status END
 WHERE id=o.id RETURNING * INTO o;
 RETURN jsonb_build_object('ok',true,'payment_status',o.payment_status,'status',o.status,
  'review_required',review,'notify_merchant',(review AND previous_detail IS DISTINCT FROM detail) OR (o.payment_status='approved' AND previous_payment<>'approved'));
END;$fn$;
REVOKE ALL ON FUNCTION public.platform_apply_order_payment(uuid,uuid,text,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_apply_order_payment(uuid,uuid,text,text,text,timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.platform_cleanup_stale_pending_orders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE r record;n integer:=0;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' AND NOT public.platform_is_master_admin() AND NOT (coalesce(auth.role(),'')='' AND session_user IN ('postgres','supabase_admin')) THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
 FOR r IN SELECT id FROM public.orders WHERE payment_method='mercadopago' AND payment_status='pending' AND status='payment_pending' AND created_at<now()-interval '45 minutes' FOR UPDATE SKIP LOCKED LOOP
  PERFORM public.restore_order_stock_v47(r.id);
  UPDATE public.orders SET status='cancelled',payment_status='cancelled',payment_status_detail='expired_pending_payment' WHERE id=r.id;
  n:=n+1;
 END LOOP;
 RETURN n;
END;$fn$;

CREATE OR REPLACE FUNCTION public.platform_update_order_status(p_order_id uuid,p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE o public.orders;
BEGIN
 IF p_status NOT IN ('new','payment_pending','paid','preparing','ready','delivered','cancelled') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF o.id IS NULL THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
 IF NOT public.platform_is_site_member(o.site_id) THEN RAISE EXCEPTION 'SITE_ACCESS_DENIED'; END IF;
 IF o.stock_restored AND p_status<>'cancelled' THEN RAISE EXCEPTION 'STOCK_RELEASED_REVIEW_REQUIRED'; END IF;
 IF o.payment_method='mercadopago' AND o.payment_status<>'approved' AND p_status NOT IN ('payment_pending','cancelled') THEN RAISE EXCEPTION 'PAYMENT_NOT_APPROVED'; END IF;
 IF p_status='cancelled' THEN PERFORM public.restore_order_stock_v47(o.id);END IF;
 UPDATE public.orders SET status=p_status WHERE id=o.id RETURNING * INTO o;
 PERFORM public.platform_audit(o.site_id,'order_status_changed','order',o.id::text,jsonb_build_object('status',p_status,'order_number',o.order_number));
 RETURN to_jsonb(o);
END;$fn$;
COMMIT;
