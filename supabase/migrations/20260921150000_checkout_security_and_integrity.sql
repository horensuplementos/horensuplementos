-- Security and integrity hardening for checkout, stock, logistics and Bling.

UPDATE public.products SET stock = GREATEST(stock, 0) WHERE stock < 0;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS shipping_width_cm numeric NOT NULL DEFAULT 20 CHECK (shipping_width_cm > 0),
  ADD COLUMN IF NOT EXISTS shipping_height_cm numeric NOT NULL DEFAULT 10 CHECK (shipping_height_cm > 0),
  ADD COLUMN IF NOT EXISTS shipping_length_cm numeric NOT NULL DEFAULT 30 CHECK (shipping_length_cm > 0),
  ADD COLUMN IF NOT EXISTS shipping_weight_kg numeric NOT NULL DEFAULT 0.5 CHECK (shipping_weight_kg > 0),
  ADD CONSTRAINT products_stock_nonnegative CHECK (stock >= 0);

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (
  status = ANY (ARRAY[
    'pendente'::text,
    'aguardando_pagamento'::text,
    'pago'::text,
    'nota_emitida'::text,
    'separado'::text,
    'enviado'::text,
    'entregue'::text,
    'cancelado'::text,
    'aguardando_pagamento_melhor_envio'::text
  ])
);

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_quantity_positive CHECK (quantity > 0),
  ADD CONSTRAINT order_items_unit_price_nonnegative CHECK (unit_price >= 0);

-- Checkout is created only by the server-side function. RLS remains in force for
-- customers to read their own orders and for operations to manage them.
DROP POLICY IF EXISTS "Users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create order items" ON public.order_items;

-- Make stock decrement atomic: an approved payment can never make stock negative.
CREATE OR REPLACE FUNCTION public.decrease_stock_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pago' AND OLD.status IS DISTINCT FROM 'pago' THEN
    PERFORM 1
    FROM public.products p
    JOIN public.order_items oi ON oi.product_id = p.id
    WHERE oi.order_id = NEW.id
    FOR UPDATE OF p;

    IF EXISTS (
      SELECT 1
      FROM public.products p
      JOIN public.order_items oi ON oi.product_id = p.id
      WHERE oi.order_id = NEW.id
        AND p.stock < oi.quantity
    ) THEN
      RAISE EXCEPTION 'Estoque insuficiente para confirmar este pedido.';
    END IF;

    UPDATE public.products p
    SET stock = p.stock - oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.product_id = p.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS decrease_stock_on_payment ON public.orders;
DROP TRIGGER IF EXISTS decrease_stock_on_payment_trigger ON public.orders;
CREATE TRIGGER decrease_stock_on_payment_trigger
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.decrease_stock_on_payment();

-- Browser clients must never be able to read persisted OAuth secrets or tokens.
DROP POLICY IF EXISTS "Admins can manage bling credentials" ON public.bling_credentials;

CREATE TABLE IF NOT EXISTS public.bling_oauth_states (
  state uuid PRIMARY KEY,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bling_oauth_states ENABLE ROW LEVEL SECURITY;

-- Keep cart session identity bound to the caller when authenticated.
CREATE OR REPLACE FUNCTION public.upsert_cart_session(
  p_session_id TEXT,
  p_user_id UUID,
  p_email TEXT,
  p_status public.cart_session_status,
  p_items JSONB,
  p_items_count INTEGER,
  p_cart_total NUMERIC,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  IF p_session_id IS NULL OR trim(p_session_id) = '' THEN
    RAISE EXCEPTION 'session_id é obrigatório';
  END IF;

  IF p_user_id IS NOT NULL AND v_user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Usuário de carrinho inválido';
  END IF;

  INSERT INTO public.cart_sessions (
    session_id, user_id, email, status, items, items_count, cart_total,
    first_product_added_at, last_activity_at, metadata
  ) VALUES (
    trim(p_session_id), v_user_id, lower(NULLIF(trim(COALESCE(p_email, '')), '')),
    COALESCE(p_status, 'active'), COALESCE(p_items, '[]'::jsonb),
    GREATEST(COALESCE(p_items_count, 0), 0), GREATEST(COALESCE(p_cart_total, 0), 0),
    CASE WHEN COALESCE(p_items_count, 0) > 0 THEN now() ELSE NULL END,
    now(), COALESCE(p_metadata, '{}'::jsonb)
  ) ON CONFLICT (session_id) DO UPDATE
  SET user_id = COALESCE(EXCLUDED.user_id, public.cart_sessions.user_id),
      email = COALESCE(EXCLUDED.email, public.cart_sessions.email),
      status = EXCLUDED.status,
      items = EXCLUDED.items,
      items_count = EXCLUDED.items_count,
      cart_total = EXCLUDED.cart_total,
      last_activity_at = now(),
      first_product_added_at = COALESCE(public.cart_sessions.first_product_added_at, EXCLUDED.first_product_added_at),
      metadata = COALESCE(EXCLUDED.metadata, public.cart_sessions.metadata),
      updated_at = now()
  WHERE public.cart_sessions.user_id IS NULL
     OR public.cart_sessions.user_id = v_user_id
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Sessão de carrinho não pertence ao usuário atual';
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_cart_session(TEXT, UUID, TEXT, public.cart_session_status, JSONB, INTEGER, NUMERIC, JSONB) TO anon, authenticated;
