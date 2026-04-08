ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS shipping_service_id integer,
  ADD COLUMN IF NOT EXISTS shipping_service_name text,
  ADD COLUMN IF NOT EXISTS shipping_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_order_id text,
  ADD COLUMN IF NOT EXISTS tracking_code text,
  ADD COLUMN IF NOT EXISTS shipping_status text DEFAULT 'pendente';