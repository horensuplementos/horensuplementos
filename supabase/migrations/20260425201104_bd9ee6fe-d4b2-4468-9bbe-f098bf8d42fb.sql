-- Recriar a view coupon_usage_summary incluindo minimum_order_amount
DROP VIEW IF EXISTS public.coupon_usage_summary;

CREATE VIEW public.coupon_usage_summary
WITH (security_invoker=true) AS
SELECT 
  c.id,
  c.code,
  c.description,
  c.discount_type,
  c.discount_value,
  c.minimum_order_amount,
  c.active,
  c.usage_limit,
  c.starts_at,
  c.expires_at,
  COUNT(o.id) FILTER (WHERE o.status <> 'cancelado')::integer AS total_uses,
  COALESCE(SUM(o.discount_amount) FILTER (WHERE o.status <> 'cancelado'), 0)::numeric(10,2) AS total_discount_generated,
  MAX(o.created_at) AS last_used_at
FROM public.coupons c
LEFT JOIN public.orders o ON o.coupon_id = c.id
GROUP BY c.id;