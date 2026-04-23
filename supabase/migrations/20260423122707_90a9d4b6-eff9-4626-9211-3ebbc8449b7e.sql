CREATE TYPE public.coupon_discount_type AS ENUM ('fixed', 'percentage');

CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type public.coupon_discount_type NOT NULL,
  discount_value NUMERIC(10,2) NOT NULL,
  minimum_order_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  usage_limit INTEGER,
  starts_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT coupons_code_format CHECK (char_length(trim(code)) >= 3),
  CONSTRAINT coupons_discount_value_positive CHECK (discount_value > 0),
  CONSTRAINT coupons_usage_limit_positive CHECK (usage_limit IS NULL OR usage_limit > 0),
  CONSTRAINT coupons_minimum_order_amount_nonnegative CHECK (minimum_order_amount >= 0)
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all coupons"
ON public.coupons
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create coupons"
ON public.coupons
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update coupons"
ON public.coupons
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete coupons"
ON public.coupons
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.orders
ADD COLUMN subtotal_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
ADD COLUMN discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
ADD COLUMN coupon_id UUID,
ADD COLUMN coupon_code TEXT;

UPDATE public.orders
SET subtotal_amount = GREATEST(total - COALESCE(shipping_price, 0), 0),
    discount_amount = COALESCE(discount_amount, 0)
WHERE subtotal_amount = 0;

CREATE INDEX idx_coupons_code ON public.coupons (upper(code));
CREATE INDEX idx_orders_coupon_id ON public.orders (coupon_id);
CREATE INDEX idx_orders_coupon_code ON public.orders (coupon_code);

ALTER TABLE public.orders
ADD CONSTRAINT orders_coupon_id_fkey
FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.normalize_coupon_code(p_code TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(upper(trim(COALESCE(p_code, ''))), '')
$$;

CREATE OR REPLACE FUNCTION public.calculate_coupon_discount(
  p_discount_type public.coupon_discount_type,
  p_discount_value NUMERIC,
  p_subtotal NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_discount NUMERIC := 0;
BEGIN
  IF p_subtotal IS NULL OR p_subtotal <= 0 THEN
    RETURN 0;
  END IF;

  IF p_discount_type = 'fixed' THEN
    v_discount := p_discount_value;
  ELSE
    v_discount := round((p_subtotal * p_discount_value) / 100.0, 2);
  END IF;

  RETURN LEAST(p_subtotal, GREATEST(v_discount, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_coupon(p_code TEXT, p_subtotal NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT := public.normalize_coupon_code(p_code);
  v_coupon public.coupons%ROWTYPE;
  v_usage_count INTEGER := 0;
  v_discount NUMERIC := 0;
BEGIN
  IF v_code IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'Informe um código de cupom.'
    );
  END IF;

  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE upper(code) = v_code;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'Cupom não encontrado.'
    );
  END IF;

  IF NOT v_coupon.active THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'Este cupom está inativo.'
    );
  END IF;

  IF v_coupon.starts_at IS NOT NULL AND now() < v_coupon.starts_at THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'Este cupom ainda não está disponível.'
    );
  END IF;

  IF v_coupon.expires_at IS NOT NULL AND now() > v_coupon.expires_at THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'Este cupom expirou.'
    );
  END IF;

  IF COALESCE(p_subtotal, 0) < v_coupon.minimum_order_amount THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'Pedido mínimo não atingido para este cupom.',
      'minimum_order_amount', v_coupon.minimum_order_amount
    );
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_usage_count
  FROM public.orders
  WHERE coupon_id = v_coupon.id
    AND status <> 'cancelado';

  IF v_coupon.usage_limit IS NOT NULL AND v_usage_count >= v_coupon.usage_limit THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'Este cupom atingiu o limite de uso.'
    );
  END IF;

  v_discount := public.calculate_coupon_discount(v_coupon.discount_type, v_coupon.discount_value, p_subtotal);

  RETURN jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'code', public.normalize_coupon_code(v_coupon.code),
    'description', v_coupon.description,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'discount_amount', v_discount,
    'minimum_order_amount', v_coupon.minimum_order_amount,
    'usage_limit', v_coupon.usage_limit,
    'usage_count', v_usage_count,
    'subtotal_after_discount', GREATEST(COALESCE(p_subtotal, 0) - v_discount, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(TEXT, NUMERIC) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_coupon_to_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon public.coupons%ROWTYPE;
  v_usage_count INTEGER := 0;
  v_discount NUMERIC := 0;
  v_shipping NUMERIC := COALESCE(NEW.shipping_price, 0);
  v_code TEXT := public.normalize_coupon_code(NEW.coupon_code);
BEGIN
  NEW.subtotal_amount := GREATEST(COALESCE(NEW.subtotal_amount, 0), 0);
  NEW.shipping_price := v_shipping;

  IF v_code IS NULL THEN
    NEW.coupon_id := NULL;
    NEW.coupon_code := NULL;
    NEW.discount_amount := 0;
    NEW.total := GREATEST(NEW.subtotal_amount + v_shipping, 0);
    RETURN NEW;
  END IF;

  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE upper(code) = v_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cupom inválido.';
  END IF;

  IF NOT v_coupon.active THEN
    RAISE EXCEPTION 'Cupom inativo.';
  END IF;

  IF v_coupon.starts_at IS NOT NULL AND now() < v_coupon.starts_at THEN
    RAISE EXCEPTION 'Cupom ainda não disponível.';
  END IF;

  IF v_coupon.expires_at IS NOT NULL AND now() > v_coupon.expires_at THEN
    RAISE EXCEPTION 'Cupom expirado.';
  END IF;

  IF NEW.subtotal_amount < v_coupon.minimum_order_amount THEN
    RAISE EXCEPTION 'Pedido mínimo não atingido para este cupom.';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_usage_count
  FROM public.orders
  WHERE coupon_id = v_coupon.id
    AND status <> 'cancelado'
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF v_coupon.usage_limit IS NOT NULL AND v_usage_count >= v_coupon.usage_limit THEN
    RAISE EXCEPTION 'Cupom atingiu o limite de uso.';
  END IF;

  v_discount := public.calculate_coupon_discount(v_coupon.discount_type, v_coupon.discount_value, NEW.subtotal_amount);

  NEW.coupon_id := v_coupon.id;
  NEW.coupon_code := public.normalize_coupon_code(v_coupon.code);
  NEW.discount_amount := v_discount;
  NEW.total := GREATEST(NEW.subtotal_amount + v_shipping - v_discount, 0);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_coupon_to_order_trigger ON public.orders;
CREATE TRIGGER apply_coupon_to_order_trigger
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.apply_coupon_to_order();

CREATE OR REPLACE VIEW public.coupon_usage_summary AS
SELECT
  c.id,
  c.code,
  c.description,
  c.discount_type,
  c.discount_value,
  c.active,
  c.usage_limit,
  c.starts_at,
  c.expires_at,
  COUNT(o.id) FILTER (WHERE o.status <> 'cancelado')::INTEGER AS total_uses,
  COALESCE(SUM(o.discount_amount) FILTER (WHERE o.status <> 'cancelado'), 0)::NUMERIC(10,2) AS total_discount_generated,
  MAX(o.created_at) AS last_used_at
FROM public.coupons c
LEFT JOIN public.orders o ON o.coupon_id = c.id
GROUP BY c.id;

GRANT SELECT ON public.coupon_usage_summary TO authenticated;