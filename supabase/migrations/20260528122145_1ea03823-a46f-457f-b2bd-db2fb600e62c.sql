
-- Revoke EXECUTE from anon/authenticated/public on SECURITY DEFINER functions
-- that should only be called by the backend (service_role) or via triggers.

DO $$
DECLARE
  fn TEXT;
  fns TEXT[] := ARRAY[
    'public.delete_email(text, bigint)',
    'public.enqueue_email(text, jsonb)',
    'public.read_email_batch(text, integer, integer)',
    'public.move_to_dlq(text, text, bigint, jsonb)',
    'public.accept_admin_invitation(uuid, text)',
    'public.accept_admin_invitation_by_token(uuid, uuid)',
    'public.upsert_cart_session(text, uuid, text, public.cart_session_status, jsonb, integer, numeric, jsonb)',
    'public.mark_stale_carts_abandoned(integer)',
    'public.has_admin_permission_level(uuid, public.admin_permission_level[])',
    'public.has_role(uuid, public.app_role)',
    'public.apply_coupon_to_order()',
    'public.decrease_stock_on_payment()',
    'public.handle_new_user()',
    'public.ensure_single_default_address()',
    'public.update_cart_session_status_on_order()',
    'public.update_updated_at_column()',
    'public.calculate_coupon_discount(public.coupon_discount_type, numeric, numeric)',
    'public.normalize_coupon_code(text)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;

-- has_role and has_admin_permission_level are used inside RLS policies,
-- which run with the caller role; grant EXECUTE back to authenticated only.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_admin_permission_level(uuid, public.admin_permission_level[]) TO authenticated;

-- accept_admin_invitation functions are called by the authenticated user accepting the invite.
GRANT EXECUTE ON FUNCTION public.accept_admin_invitation(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_admin_invitation_by_token(uuid, uuid) TO authenticated;

-- upsert_cart_session is called from the client for guest + logged users.
GRANT EXECUTE ON FUNCTION public.upsert_cart_session(text, uuid, text, public.cart_session_status, jsonb, integer, numeric, jsonb) TO anon, authenticated;

-- validate_coupon remains callable by everyone (public checkout).
-- (no change needed; default grants remain).
