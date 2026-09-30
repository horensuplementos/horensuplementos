-- Lovable Cloud mirror of 20260930130000_fix_product_image_sync.sql.
CREATE OR REPLACE FUNCTION public.sync_product_primary_image()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.image_urls := coalesce(NEW.image_urls, ARRAY[]::text[]);

  IF TG_OP = 'INSERT' THEN
    IF cardinality(NEW.image_urls) = 0 AND nullif(NEW.image_url, '') IS NOT NULL THEN
      NEW.image_urls := ARRAY[NEW.image_url];
    END IF;
  ELSIF NEW.image_urls IS NOT DISTINCT FROM OLD.image_urls
    AND NEW.image_url IS DISTINCT FROM OLD.image_url THEN
    NEW.image_urls := CASE
      WHEN nullif(NEW.image_url, '') IS NULL THEN ARRAY[]::text[]
      ELSE ARRAY[NEW.image_url]
    END;
  END IF;

  NEW.image_url := nullif(NEW.image_urls[1], '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_product_primary_image ON public.products;
CREATE TRIGGER sync_product_primary_image
BEFORE INSERT OR UPDATE OF image_urls, image_url ON public.products
FOR EACH ROW EXECUTE FUNCTION public.sync_product_primary_image();