DROP POLICY IF EXISTS "Admins can view profiles for order management" ON public.profiles;
CREATE POLICY "Admins and operators can view profiles for order management"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_admin_permission_level(auth.uid(), ARRAY['admin','operator']::public.admin_permission_level[])
);

DROP POLICY IF EXISTS "Users can insert own cart sessions" ON public.cart_sessions;
CREATE POLICY "Users can insert own cart sessions"
ON public.cart_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own cart sessions" ON public.cart_sessions;
CREATE POLICY "Users can update own cart sessions"
ON public.cart_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own cart sessions" ON public.cart_sessions;
CREATE POLICY "Users can delete own cart sessions"
ON public.cart_sessions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);