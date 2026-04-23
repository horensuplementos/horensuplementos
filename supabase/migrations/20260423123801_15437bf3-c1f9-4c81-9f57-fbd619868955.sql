CREATE TYPE public.admin_permission_level AS ENUM ('admin', 'operator', 'editor');
CREATE TYPE public.cart_session_status AS ENUM ('active', 'abandoned', 'converted', 'recovered');

CREATE TABLE public.site_content_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_key TEXT NOT NULL UNIQUE,
  title TEXT,
  subtitle TEXT,
  description TEXT,
  cta_label TEXT,
  cta_link TEXT,
  image_url TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT site_content_sections_key_length CHECK (char_length(trim(section_key)) >= 2)
);

ALTER TABLE public.site_content_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active site content"
ON public.site_content_sections
FOR SELECT
USING (active = true);

CREATE POLICY "Admins can manage site content"
ON public.site_content_sections
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.admin_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  permission_level public.admin_permission_level NOT NULL DEFAULT 'editor',
  invited_by UUID,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view admin profiles"
ON public.admin_profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage admin profiles"
ON public.admin_profiles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own admin profile"
ON public.admin_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE TABLE public.admin_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  permission_level public.admin_permission_level NOT NULL DEFAULT 'editor',
  invited_by UUID,
  accepted_by UUID,
  accepted_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT admin_invitations_email_format CHECK (position('@' in email) > 1)
);

CREATE UNIQUE INDEX admin_invitations_email_active_unique
ON public.admin_invitations (lower(email))
WHERE accepted_at IS NULL AND revoked_at IS NULL;

ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view invitations"
ON public.admin_invitations
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage invitations"
ON public.admin_invitations
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.cart_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  user_id UUID,
  email TEXT,
  status public.cart_session_status NOT NULL DEFAULT 'active',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  items_count INTEGER NOT NULL DEFAULT 0,
  cart_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  first_product_added_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  abandoned_at TIMESTAMP WITH TIME ZONE,
  recovery_sent_at TIMESTAMP WITH TIME ZONE,
  recovered_at TIMESTAMP WITH TIME ZONE,
  converted_order_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cart_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view cart sessions"
ON public.cart_sessions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own cart sessions"
ON public.cart_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

ALTER TABLE public.orders
ADD COLUMN cart_session_id UUID;

CREATE INDEX idx_orders_cart_session_id ON public.orders (cart_session_id);
CREATE INDEX idx_cart_sessions_status ON public.cart_sessions (status, last_activity_at DESC);
CREATE INDEX idx_cart_sessions_user_id ON public.cart_sessions (user_id);

ALTER TABLE public.orders
ADD CONSTRAINT orders_cart_session_id_fkey
FOREIGN KEY (cart_session_id) REFERENCES public.cart_sessions(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.accept_admin_invitation(p_user_id UUID, p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation public.admin_invitations%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_email IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'message', 'Dados inválidos.');
  END IF;

  SELECT * INTO v_invitation
  FROM public.admin_invitations
  WHERE lower(email) = lower(trim(p_email))
    AND accepted_at IS NULL
    AND revoked_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('accepted', false, 'message', 'Nenhum convite pendente.');
  END IF;

  INSERT INTO public.admin_profiles (user_id, email, permission_level, invited_by, active)
  VALUES (p_user_id, lower(trim(p_email)), v_invitation.permission_level, v_invitation.invited_by, true)
  ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email,
      permission_level = EXCLUDED.permission_level,
      invited_by = EXCLUDED.invited_by,
      active = true,
      updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.admin_invitations
  SET accepted_at = now(),
      accepted_by = p_user_id,
      updated_at = now()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object('accepted', true, 'permission_level', v_invitation.permission_level);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_admin_invitation(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_cart_session(
  p_session_id TEXT,
  p_user_id UUID,
  p_email TEXT,
  p_status public.cart_session_status,
  p_items JSONB,
  p_items_count INTEGER,
  p_cart_total NUMERIC,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_session_id IS NULL OR trim(p_session_id) = '' THEN
    RAISE EXCEPTION 'session_id é obrigatório';
  END IF;

  INSERT INTO public.cart_sessions (
    session_id, user_id, email, status, items, items_count, cart_total,
    first_product_added_at, last_activity_at, metadata
  )
  VALUES (
    trim(p_session_id), p_user_id, lower(NULLIF(trim(COALESCE(p_email, '')), '')), COALESCE(p_status, 'active'),
    COALESCE(p_items, '[]'::jsonb), COALESCE(p_items_count, 0), COALESCE(p_cart_total, 0),
    CASE WHEN COALESCE(p_items_count, 0) > 0 THEN now() ELSE NULL END,
    now(), COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (session_id) DO UPDATE
  SET user_id = COALESCE(EXCLUDED.user_id, public.cart_sessions.user_id),
      email = COALESCE(EXCLUDED.email, public.cart_sessions.email),
      status = EXCLUDED.status,
      items = EXCLUDED.items,
      items_count = EXCLUDED.items_count,
      cart_total = EXCLUDED.cart_total,
      last_activity_at = now(),
      first_product_added_at = COALESCE(public.cart_sessions.first_product_added_at, EXCLUDED.first_product_added_at),
      metadata = COALESCE(EXCLUDED.metadata, public.cart_sessions.metadata),
      updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_cart_session(TEXT, UUID, TEXT, public.cart_session_status, JSONB, INTEGER, NUMERIC, JSONB) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.mark_stale_carts_abandoned(p_minutes INTEGER DEFAULT 60)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.cart_sessions
  SET status = 'abandoned',
      abandoned_at = now(),
      updated_at = now()
  WHERE status = 'active'
    AND items_count > 0
    AND last_activity_at < now() - make_interval(mins => GREATEST(COALESCE(p_minutes, 60), 1));

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_stale_carts_abandoned(INTEGER) TO authenticated;

INSERT INTO public.site_content_sections (section_key, title, subtitle, description, cta_label, cta_link, image_url, items)
VALUES
  (
    'hero_banner',
    'Creatina de verdade para evolução diária',
    'ESPECIALISTAS EM CREATINA',
    'Linha focada em creatina, performance e consistência para quem compra com critério e quer resultado real.',
    'Ver creatinas',
    '#produtos',
    NULL,
    jsonb_build_array(
      jsonb_build_object('title', 'Creatina Horen', 'subtitle', 'DESTAQUE', 'description', 'Creatina com comunicação direta, foco em pureza e performance diária.', 'cta', 'Comprar agora', 'link', '#produtos', 'image_url', NULL),
      jsonb_build_object('title', 'Protocolos simples que convertem', 'subtitle', 'ROTINA EFICIENTE', 'description', 'Mensagens claras para quem quer entender dose, rotina e benefício sem enrolação.', 'cta', 'Ver linha completa', 'link', '#produtos', 'image_url', NULL),
      jsonb_build_object('title', 'Mais confiança na decisão', 'subtitle', 'PROVA DE QUALIDADE', 'description', 'Site, banners e argumentos com foco em qualidade, clareza e compra segura.', 'cta', 'Explorar produtos', 'link', '#produtos', 'image_url', NULL)
    )
  ),
  (
    'promo_banner',
    'Faixa promocional',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    jsonb_build_array(
      jsonb_build_object('text', 'Creatina premium com foco em pureza e consistência', 'link', '#produtos'),
      jsonb_build_object('text', 'Frete competitivo e checkout rápido para recompra', 'link', '#produtos'),
      jsonb_build_object('text', 'Comunicação objetiva para decisão sem atrito', 'link', '#produtos')
    )
  ),
  (
    'products_section',
    'Linha especialista em creatina',
    'NOSSOS PRODUTOS',
    'Seleção com foco em creatina, performance e recompra.',
    NULL,
    NULL,
    NULL,
    '[]'::jsonb
  ),
  (
    'about_section',
    'Especialistas em creatina, confiança em cada detalhe',
    'SOBRE A HOREN',
    'A Horen posiciona sua linha para quem busca creatina com clareza de proposta, padrão consistente e compra segura.',
    NULL,
    NULL,
    NULL,
    jsonb_build_array(
      jsonb_build_object('title', 'Pureza', 'description', 'Comunicação e produto alinhados para transmitir critério e segurança.'),
      jsonb_build_object('title', 'Clareza', 'description', 'Explicamos proposta, uso e valor sem excesso de promessas.'),
      jsonb_build_object('title', 'Conversão', 'description', 'Banners, textos e seções desenhados para reduzir atrito na compra.'),
      jsonb_build_object('title', 'Recompra', 'description', 'Estrutura pronta para relacionamento, cupom e recuperação de carrinho.')
    )
  ),
  (
    'footer',
    'Horen',
    NULL,
    'Creatina e suplementação com comunicação profissional, direta e preparada para vender mais.',
    NULL,
    NULL,
    NULL,
    jsonb_build_array(
      jsonb_build_object('type', 'email', 'label', 'contato@horen.com.br', 'href', 'mailto:contato@horen.com.br'),
      jsonb_build_object('type', 'phone', 'label', '(11) 99999-9999', 'href', 'tel:+5511999999999'),
      jsonb_build_object('type', 'instagram', 'label', '@horensuplementos', 'href', 'https://www.instagram.com/horensuplementos/')
    )
  )
ON CONFLICT (section_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.update_cart_session_status_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cart_session_id IS NOT NULL THEN
    UPDATE public.cart_sessions
    SET status = CASE WHEN status = 'recovered' THEN 'recovered' ELSE 'converted' END,
        converted_order_id = NEW.id,
        email = COALESCE(lower(NULLIF(trim(NEW.customer_email), '')), email),
        user_id = COALESCE(NEW.user_id, user_id),
        recovered_at = CASE WHEN status = 'abandoned' THEN now() ELSE recovered_at END,
        last_activity_at = now(),
        updated_at = now()
    WHERE id = NEW.cart_session_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_cart_session_status_on_order_trigger ON public.orders;
CREATE TRIGGER update_cart_session_status_on_order_trigger
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_cart_session_status_on_order();

INSERT INTO storage.buckets (id, name, public)
VALUES ('site-assets', 'site-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view site assets"
ON storage.objects
FOR SELECT
USING (bucket_id = 'site-assets');

CREATE POLICY "Admins can upload site assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update site assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete site assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE VIEW public.cart_metrics_summary AS
SELECT
  COUNT(*) FILTER (WHERE items_count > 0) :: INTEGER AS carts_with_items,
  COUNT(*) FILTER (WHERE status = 'abandoned') :: INTEGER AS abandoned_carts,
  COUNT(*) FILTER (WHERE status IN ('converted', 'recovered')) :: INTEGER AS converted_carts,
  COUNT(*) FILTER (WHERE status = 'recovered') :: INTEGER AS recovered_carts,
  COALESCE(SUM(cart_total) FILTER (WHERE status = 'abandoned'), 0)::NUMERIC(10,2) AS abandoned_value,
  COALESCE(SUM(cart_total) FILTER (WHERE status IN ('converted', 'recovered')), 0)::NUMERIC(10,2) AS converted_value
FROM public.cart_sessions;

ALTER VIEW public.cart_metrics_summary SET (security_invoker = true);
GRANT SELECT ON public.cart_metrics_summary TO authenticated;