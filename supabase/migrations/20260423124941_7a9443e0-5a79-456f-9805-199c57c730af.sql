CREATE OR REPLACE FUNCTION public.has_admin_permission_level(_user_id uuid, _levels public.admin_permission_level[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_profiles
    WHERE user_id = _user_id
      AND active = true
      AND permission_level = ANY(_levels)
  )
$$;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'order_items'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'order_id'
  LOOP
    EXECUTE format('ALTER TABLE public.order_items DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_order_id_fkey
  FOREIGN KEY (order_id)
  REFERENCES public.orders(id)
  ON DELETE CASCADE;

DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins and operators can view all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.has_admin_permission_level(auth.uid(), ARRAY['admin','operator']::public.admin_permission_level[]));

DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
CREATE POLICY "Admins and operators can update orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (public.has_admin_permission_level(auth.uid(), ARRAY['admin','operator']::public.admin_permission_level[]));

DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "Admins and operators can delete orders"
ON public.orders
FOR DELETE
TO authenticated
USING (public.has_admin_permission_level(auth.uid(), ARRAY['admin','operator']::public.admin_permission_level[]));

DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;
CREATE POLICY "Admins and operators can view all order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (public.has_admin_permission_level(auth.uid(), ARRAY['admin','operator']::public.admin_permission_level[]));

DROP POLICY IF EXISTS "Admins can delete order items" ON public.order_items;
CREATE POLICY "Admins and operators can delete order items"
ON public.order_items
FOR DELETE
TO authenticated
USING (public.has_admin_permission_level(auth.uid(), ARRAY['admin','operator']::public.admin_permission_level[]));

DROP POLICY IF EXISTS "Admins can manage site content" ON public.site_content_sections;
CREATE POLICY "Admins and editors can manage site content"
ON public.site_content_sections
FOR ALL
TO authenticated
USING (public.has_admin_permission_level(auth.uid(), ARRAY['admin','editor']::public.admin_permission_level[]))
WITH CHECK (public.has_admin_permission_level(auth.uid(), ARRAY['admin','editor']::public.admin_permission_level[]));

DROP TRIGGER IF EXISTS apply_coupon_to_order_trigger ON public.orders;
CREATE TRIGGER apply_coupon_to_order_trigger
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.apply_coupon_to_order();

DROP TRIGGER IF EXISTS update_cart_session_status_on_order_trigger ON public.orders;
CREATE TRIGGER update_cart_session_status_on_order_trigger
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_cart_session_status_on_order();

DROP TRIGGER IF EXISTS decrease_stock_on_payment_trigger ON public.orders;
CREATE TRIGGER decrease_stock_on_payment_trigger
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.decrease_stock_on_payment();

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_coupons_updated_at ON public.coupons;
CREATE TRIGGER update_coupons_updated_at
BEFORE UPDATE ON public.coupons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_admin_profiles_updated_at ON public.admin_profiles;
CREATE TRIGGER update_admin_profiles_updated_at
BEFORE UPDATE ON public.admin_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_admin_invitations_updated_at ON public.admin_invitations;
CREATE TRIGGER update_admin_invitations_updated_at
BEFORE UPDATE ON public.admin_invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_cart_sessions_updated_at ON public.cart_sessions;
CREATE TRIGGER update_cart_sessions_updated_at
BEFORE UPDATE ON public.cart_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_site_content_sections_updated_at ON public.site_content_sections;
CREATE TRIGGER update_site_content_sections_updated_at
BEFORE UPDATE ON public.site_content_sections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();