CREATE TABLE public.blog_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  category TEXT,
  read_time TEXT,
  cover_image_url TEXT,
  content TEXT NOT NULL DEFAULT '',
  published BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published posts"
  ON public.blog_posts FOR SELECT
  USING (published = true);

CREATE POLICY "Admins and editors can view all posts"
  ON public.blog_posts FOR SELECT
  TO authenticated
  USING (has_admin_permission_level(auth.uid(), ARRAY['admin'::admin_permission_level, 'editor'::admin_permission_level]));

CREATE POLICY "Admins and editors can insert posts"
  ON public.blog_posts FOR INSERT
  TO authenticated
  WITH CHECK (has_admin_permission_level(auth.uid(), ARRAY['admin'::admin_permission_level, 'editor'::admin_permission_level]));

CREATE POLICY "Admins and editors can update posts"
  ON public.blog_posts FOR UPDATE
  TO authenticated
  USING (has_admin_permission_level(auth.uid(), ARRAY['admin'::admin_permission_level, 'editor'::admin_permission_level]))
  WITH CHECK (has_admin_permission_level(auth.uid(), ARRAY['admin'::admin_permission_level, 'editor'::admin_permission_level]));

CREATE POLICY "Admins and editors can delete posts"
  ON public.blog_posts FOR DELETE
  TO authenticated
  USING (has_admin_permission_level(auth.uid(), ARRAY['admin'::admin_permission_level, 'editor'::admin_permission_level]));

CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_blog_posts_published ON public.blog_posts(published, published_at DESC);