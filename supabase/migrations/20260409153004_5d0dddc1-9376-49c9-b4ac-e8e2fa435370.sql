
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_cpf text;
