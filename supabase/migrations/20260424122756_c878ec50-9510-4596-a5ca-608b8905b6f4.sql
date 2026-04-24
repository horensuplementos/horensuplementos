
-- Fix any existing negative stock
UPDATE public.products SET stock = 0 WHERE stock < 0;

-- Add CHECK constraint to prevent negative stock
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_stock_non_negative;
ALTER TABLE public.products
  ADD CONSTRAINT products_stock_non_negative CHECK (stock >= 0);

-- Update decrease_stock_on_payment to clamp at zero
CREATE OR REPLACE FUNCTION public.decrease_stock_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'pago' AND OLD.status = 'pendente' THEN
    UPDATE public.products p
    SET stock = GREATEST(p.stock - oi.quantity, 0)
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id AND oi.product_id = p.id;
  END IF;
  RETURN NEW;
END;
$function$;
