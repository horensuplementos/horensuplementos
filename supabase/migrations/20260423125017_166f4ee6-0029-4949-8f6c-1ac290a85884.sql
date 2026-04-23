DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
CREATE POLICY "Public can read product image by path"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'product-images'
  AND name IS NOT NULL
  AND length(name) > 0
  AND position('/' in name) = 0
);

DROP POLICY IF EXISTS "Public can view site assets" ON storage.objects;
CREATE POLICY "Public can read site asset by path"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'site-assets'
  AND name IS NOT NULL
  AND length(name) > 0
  AND position('/' in name) = 0
);