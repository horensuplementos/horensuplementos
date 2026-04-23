ALTER TYPE public.coupon_discount_type ADD VALUE IF NOT EXISTS 'free_shipping';

CREATE OR REPLACE FUNCTION public.calculate_coupon_discount(
  p_discount_type public.coupon_discount_type,
  p_discount_value numeric,
  p_subtotal numeric
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_discount NUMERIC := 0;
BEGIN
  IF p_subtotal IS NULL OR p_subtotal <= 0 THEN
    RETURN 0;
  END IF;

  IF p_discount_type = 'fixed' THEN
    v_discount := p_discount_value;
  ELSIF p_discount_type = 'percentage' THEN
    v_discount := round((p_subtotal * p_discount_value) / 100.0, 2);
  ELSE
    v_discount := 0;
  END IF;

  RETURN LEAST(p_subtotal, GREATEST(v_discount, 0));
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_coupon(p_code text, p_subtotal numeric)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code TEXT := public.normalize_coupon_code(p_code);
  v_coupon public.coupons%ROWTYPE;
  v_usage_count INTEGER := 0;
  v_discount NUMERIC := 0;
  v_is_free_shipping BOOLEAN := false;
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

  v_is_free_shipping := v_coupon.discount_type = 'free_shipping';
  v_discount := public.calculate_coupon_discount(v_coupon.discount_type, v_coupon.discount_value, p_subtotal);

  RETURN jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'code', public.normalize_coupon_code(v_coupon.code),
    'description', v_coupon.description,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'discount_amount', v_discount,
    'is_free_shipping', v_is_free_shipping,
    'message', CASE WHEN v_is_free_shipping THEN 'Cupom aplicado: frete grátis.' ELSE 'Cupom aplicado com sucesso.' END,
    'minimum_order_amount', v_coupon.minimum_order_amount,
    'usage_limit', v_coupon.usage_limit,
    'usage_count', v_usage_count,
    'subtotal_after_discount', GREATEST(COALESCE(p_subtotal, 0) - v_discount, 0)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_coupon_to_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  IF v_coupon.discount_type = 'free_shipping' THEN
    v_discount := v_shipping;
  ELSE
    v_discount := public.calculate_coupon_discount(v_coupon.discount_type, v_coupon.discount_value, NEW.subtotal_amount);
  END IF;

  NEW.coupon_id := v_coupon.id;
  NEW.coupon_code := public.normalize_coupon_code(v_coupon.code);
  NEW.discount_amount := v_discount;
  NEW.total := GREATEST(NEW.subtotal_amount + v_shipping - v_discount, 0);

  RETURN NEW;
END;
$function$;