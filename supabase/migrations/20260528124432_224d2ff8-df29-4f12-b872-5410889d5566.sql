
-- Campos de IA em products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS flavor TEXT,
  ADD COLUMN IF NOT EXISTS benefits_input TEXT,
  ADD COLUMN IF NOT EXISTS ingredients TEXT,
  ADD COLUMN IF NOT EXISTS ai_description_short TEXT,
  ADD COLUMN IF NOT EXISTS ai_description_long TEXT,
  ADD COLUMN IF NOT EXISTS ai_benefits JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_faq JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_meta_description TEXT,
  ADD COLUMN IF NOT EXISTS ai_keywords TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Campos de IA / agendamento em blog_posts
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS meta_description TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Tabela de configuração da automação de blog
CREATE TABLE IF NOT EXISTS public.blog_automation_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT false,
  word_count INTEGER NOT NULL DEFAULT 800,
  tone TEXT NOT NULL DEFAULT 'profissional',
  categories TEXT[] NOT NULL DEFAULT ARRAY['Creatina','Whey','Hipertrofia'],
  publish_time TIME NOT NULL DEFAULT '08:00',
  auto_publish BOOLEAN NOT NULL DEFAULT false,
  last_run_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT blog_automation_singleton CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE ON public.blog_automation_settings TO authenticated;
GRANT ALL ON public.blog_automation_settings TO service_role;

ALTER TABLE public.blog_automation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage blog automation"
ON public.blog_automation_settings
FOR ALL
TO authenticated
USING (has_admin_permission_level(auth.uid(), ARRAY['admin'::admin_permission_level, 'editor'::admin_permission_level]))
WITH CHECK (has_admin_permission_level(auth.uid(), ARRAY['admin'::admin_permission_level, 'editor'::admin_permission_level]));

INSERT INTO public.blog_automation_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Log de uso da IA (rate limit / auditoria)
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  kind TEXT NOT NULL,
  target_id UUID,
  tokens_estimate INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ai_usage_log TO authenticated;
GRANT ALL ON public.ai_usage_log TO service_role;

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view ai usage"
ON public.ai_usage_log FOR SELECT TO authenticated
USING (has_admin_permission_level(auth.uid(), ARRAY['admin'::admin_permission_level, 'editor'::admin_permission_level]));

CREATE POLICY "Authenticated insert ai usage"
ON public.ai_usage_log FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
