-- Lovable Cloud / Drizzle mirror of the product gallery migration.
-- Keep this idempotent because legacy Supabase deployments may have already
-- applied the equivalent migration under supabase/migrations.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT ARRAY[]::text[];

UPDATE public.products
SET image_urls = ARRAY[image_url]
WHERE coalesce(cardinality(image_urls), 0) = 0
  AND image_url IS NOT NULL
  AND btrim(image_url) <> '';

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_image_urls_max_items;

ALTER TABLE public.products
  ADD CONSTRAINT products_image_urls_max_items
  CHECK (cardinality(image_urls) <= 8);

CREATE OR REPLACE FUNCTION public.sync_product_primary_image()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.image_urls := coalesce(NEW.image_urls, ARRAY[]::text[]);
  IF coalesce(cardinality(NEW.image_urls), 0) = 0 AND NULLIF(NEW.image_url, '') IS NOT NULL THEN
    NEW.image_urls := ARRAY[NEW.image_url];
  END IF;
  NEW.image_url := NULLIF(NEW.image_urls[1], '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_product_primary_image ON public.products;
CREATE TRIGGER sync_product_primary_image
BEFORE INSERT OR UPDATE OF image_urls ON public.products
FOR EACH ROW EXECUTE FUNCTION public.sync_product_primary_image();

UPDATE public.products
SET image_urls = coalesce(image_urls, ARRAY[]::text[]);