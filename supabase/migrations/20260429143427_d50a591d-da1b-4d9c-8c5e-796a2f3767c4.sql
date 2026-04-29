-- Tabela de endereços do usuário
CREATE TABLE public.user_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT,
  recipient_name TEXT,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  complement TEXT,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_addresses_user_id ON public.user_addresses(user_id);

ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own addresses"
ON public.user_addresses FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own addresses"
ON public.user_addresses FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own addresses"
ON public.user_addresses FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own addresses"
ON public.user_addresses FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins and operators can view addresses"
ON public.user_addresses FOR SELECT
TO authenticated
USING (has_admin_permission_level(auth.uid(), ARRAY['admin'::admin_permission_level, 'operator'::admin_permission_level]));

-- Trigger para updated_at
CREATE TRIGGER update_user_addresses_updated_at
BEFORE UPDATE ON public.user_addresses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Garantir apenas um endereço padrão por usuário
CREATE OR REPLACE FUNCTION public.ensure_single_default_address()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.user_addresses
    SET is_default = false
    WHERE user_id = NEW.user_id
      AND id <> NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ensure_single_default_address_trigger
AFTER INSERT OR UPDATE OF is_default ON public.user_addresses
FOR EACH ROW
WHEN (NEW.is_default = true)
EXECUTE FUNCTION public.ensure_single_default_address();

-- Migrar endereços existentes do profile para user_addresses como padrão
INSERT INTO public.user_addresses (
  user_id, label, street, number, complement, neighborhood, city, state, zip_code, is_default
)
SELECT
  user_id,
  'Endereço principal',
  street,
  COALESCE(number, 'S/N'),
  complement,
  COALESCE(neighborhood, '-'),
  COALESCE(city, '-'),
  COALESCE(state, '-'),
  zip_code,
  true
FROM public.profiles
WHERE street IS NOT NULL
  AND zip_code IS NOT NULL
  AND trim(street) <> ''
  AND trim(zip_code) <> '';