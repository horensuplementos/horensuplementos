ALTER TABLE public.order_items
ADD CONSTRAINT order_items_order_id_fkey_real
FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

CREATE POLICY "Admins can delete orders"
ON public.orders
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete order items"
ON public.order_items
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_site_content_sections_updated_at
BEFORE UPDATE ON public.site_content_sections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admin_profiles_updated_at
BEFORE UPDATE ON public.admin_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admin_invitations_updated_at
BEFORE UPDATE ON public.admin_invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cart_sessions_updated_at
BEFORE UPDATE ON public.cart_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();