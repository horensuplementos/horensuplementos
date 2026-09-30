-- Align the Lovable Cloud products schema with the administrative catalog.
-- Every clause is idempotent so this can safely run after the legacy
-- Supabase migrations in existing environments.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS flavor text,
  ADD COLUMN IF NOT EXISTS benefits_input text,
  ADD COLUMN IF NOT EXISTS ingredients text,
  ADD COLUMN IF NOT EXISTS ai_description_short text,
  ADD COLUMN IF NOT EXISTS ai_description_long text,
  ADD COLUMN IF NOT EXISTS ai_benefits jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_faq jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_meta_description text,
  ADD COLUMN IF NOT EXISTS ai_keywords text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS shipping_width_cm numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS shipping_height_cm numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS shipping_length_cm numeric NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS shipping_weight_kg numeric NOT NULL DEFAULT 0.5;

UPDATE public.products
SET stock = GREATEST(stock, 0),
    shipping_width_cm = GREATEST(shipping_width_cm, 0.01),
    shipping_height_cm = GREATEST(shipping_height_cm, 0.01),
    shipping_length_cm = GREATEST(shipping_length_cm, 0.01),
    shipping_weight_kg = GREATEST(shipping_weight_kg, 0.001);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_stock_nonnegative,
  DROP CONSTRAINT IF EXISTS products_shipping_width_positive,
  DROP CONSTRAINT IF EXISTS products_shipping_height_positive,
  DROP CONSTRAINT IF EXISTS products_shipping_length_positive,
  DROP CONSTRAINT IF EXISTS products_shipping_weight_positive;

ALTER TABLE public.products
  ADD CONSTRAINT products_stock_nonnegative CHECK (stock >= 0),
  ADD CONSTRAINT products_shipping_width_positive CHECK (shipping_width_cm > 0),
  ADD CONSTRAINT products_shipping_height_positive CHECK (shipping_height_cm > 0),
  ADD CONSTRAINT products_shipping_length_positive CHECK (shipping_length_cm > 0),
  ADD CONSTRAINT products_shipping_weight_positive CHECK (shipping_weight_kg > 0);
