ALTER TABLE public.coupons
DROP CONSTRAINT IF EXISTS coupons_discount_value_positive;

ALTER TABLE public.coupons
ADD CONSTRAINT coupons_discount_value_valid
CHECK (
  (
    discount_type = 'free_shipping'::public.coupon_discount_type
    AND discount_value >= 0
  )
  OR (
    discount_type <> 'free_shipping'::public.coupon_discount_type
    AND discount_value > 0
  )
);

DROP POLICY IF EXISTS "Admins can view all coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admins can create coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admins can update coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admins can delete coupons" ON public.coupons;

CREATE POLICY "Admin managers can view coupons"
ON public.coupons
FOR SELECT
TO authenticated
USING (public.has_admin_permission_level(auth.uid(), ARRAY['admin']::public.admin_permission_level[]));

CREATE POLICY "Admin managers can create coupons"
ON public.coupons
FOR INSERT
TO authenticated
WITH CHECK (public.has_admin_permission_level(auth.uid(), ARRAY['admin']::public.admin_permission_level[]));

CREATE POLICY "Admin managers can update coupons"
ON public.coupons
FOR UPDATE
TO authenticated
USING (public.has_admin_permission_level(auth.uid(), ARRAY['admin']::public.admin_permission_level[]))
WITH CHECK (public.has_admin_permission_level(auth.uid(), ARRAY['admin']::public.admin_permission_level[]));

CREATE POLICY "Admin managers can delete coupons"
ON public.coupons
FOR DELETE
TO authenticated
USING (public.has_admin_permission_level(auth.uid(), ARRAY['admin']::public.admin_permission_level[]));