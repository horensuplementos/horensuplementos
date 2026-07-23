
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status = ANY (ARRAY['pendente'::text, 'pago'::text, 'nota_emitida'::text, 'separado'::text, 'enviado'::text, 'entregue'::text, 'cancelado'::text, 'aguardando_pagamento_melhor_envio'::text]));

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_status text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_xml_url text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_issued_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_error text;
