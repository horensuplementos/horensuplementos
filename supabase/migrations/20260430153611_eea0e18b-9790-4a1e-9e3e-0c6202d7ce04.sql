-- Tabela singleton para guardar credenciais OAuth do Bling
CREATE TABLE public.bling_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT,
  client_secret TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  connected_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bling_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bling credentials"
ON public.bling_credentials
FOR ALL
TO authenticated
USING (has_admin_permission_level(auth.uid(), ARRAY['admin'::admin_permission_level]))
WITH CHECK (has_admin_permission_level(auth.uid(), ARRAY['admin'::admin_permission_level]));

CREATE TRIGGER update_bling_credentials_updated_at
BEFORE UPDATE ON public.bling_credentials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Adiciona PDF da nota fiscal nas orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_pdf_url TEXT;