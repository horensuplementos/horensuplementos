
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS invoice_number text,
ADD COLUMN IF NOT EXISTS invoice_key text,
ADD COLUMN IF NOT EXISTS bling_order_id text,
ADD COLUMN IF NOT EXISTS automation_log jsonb DEFAULT '[]'::jsonb;
