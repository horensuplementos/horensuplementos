import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Calendar } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import { supabase } from "@/integrations/supabase/client";

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  read_time: string | null;
  cover_image_url: string | null;
  content: string;
  published_at: string;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

const renderMarkdown = (content: string) =>
  content.split("\n").map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("## "))
      return (
        <h2 key={i} className="font-heading text-2xl font-bold text-foreground mt-10 mb-4">
          {trimmed.replace("## ", "")}
        </h2>
      );
    if (trimmed.startsWith("### "))
      return (
        <h3 key={i} className="font-heading text-lg font-semibold text-foreground mt-6 mb-3">
          {trimmed.replace("### ", "")}
        </h3>
      );
    if (trimmed.startsWith("- "))
      return (
        <li key={i} className="text-foreground/80 ml-4 list-disc">
          <span
            dangerouslySetInnerHTML={{
              __html: trimmed.replace("- ", "").replace(/\*\*(.*?)\*\*/g, '<strong class="text-primary">$1</strong>'),
            }}
          />
        </li>
      );
    if (/^\d+\./.test(trimmed))
      return (
        <li key={i} className="text-foreground/80 ml-4 list-decimal">
          <span
            dangerouslySetInnerHTML={{
              __html: trimmed.replace(/^\d+\.\s*/, "").replace(/\*\*(.*?)\*\*/g, '<strong class="text-primary">$1</strong>'),
            }}
          />
        </li>
      );
    return (
      <p
        key={i}
        className="text-foreground/80 leading-relaxed mb-4"
        dangerouslySetInnerHTML={{
          __html: trimmed.replace(/\*\*(.*?)\*\*/g, '<strong class="text-primary">$1</strong>'),
        }}
      />
    );
  });

const Blog = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("blog_posts")
        .select("*")
        .eq("published", true)
        .order("sort_order", { ascending: true })
        .order("published_at", { ascending: false });
      setPosts((data || []) as Post[]);
      setLoading(false);
    })();
  }, []);

  const article = posts.find((a) => a.slug === selectedSlug);

  if (article) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <CartDrawer />
        <main className="pt-20">
          <div className="container mx-auto px-6 py-12 max-w-3xl">
            <button
              onClick={() => setSelectedSlug(null)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 font-body"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao blog
            </button>

            <motion.article initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {article.category && (
                <span className="text-xs font-body tracking-[0.2em] uppercase text-primary mb-3 block">
                  {article.category}
                </span>
              )}
              <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
                {article.title}
              </h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground font-body mb-10">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {formatDate(article.published_at)}
                </span>
                {article.read_time && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {article.read_time} de leitura
                  </span>
                )}
              </div>
              {article.cover_image_url && (
                <img
                  src={article.cover_image_url}
                  alt={article.title}
                  className="w-full rounded-2xl mb-8 object-cover max-h-[420px]"
                />
              )}

              <div className="font-body">{renderMarkdown(article.content)}</div>
            </motion.article>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CartDrawer />
      <main className="pt-20">
        <div className="container mx-auto px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <span className="text-xs font-body tracking-[0.3em] uppercase text-primary mb-3 block">
              Blog
            </span>
            <h1 className="font-heading text-3xl md:text-5xl font-bold text-foreground">
              Conteúdo & Conhecimento
            </h1>
            <p className="text-muted-foreground font-body mt-4 max-w-lg mx-auto">
              Artigos sobre saúde, suplementação e performance para você alcançar seus objetivos.
            </p>
          </motion.div>

          {loading ? (
            <p className="text-center text-muted-foreground">Carregando...</p>
          ) : posts.length === 0 ? (
            <p className="text-center text-muted-foreground">Nenhum artigo publicado ainda.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {posts.map((a, index) => (
                <motion.button
                  key={a.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => setSelectedSlug(a.slug)}
                  className="text-left group"
                >
                  <div className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-all duration-300 h-full flex flex-col">
                    {a.cover_image_url ? (
                      <img src={a.cover_image_url} alt={a.title} className="h-40 w-full object-cover" />
                    ) : (
                      <div className="h-2 bg-primary/20 group-hover:bg-primary/40 transition-colors" />
                    )}
                    <div className="p-6 flex flex-col flex-1">
                      {a.category && (
                        <span className="text-[10px] font-body tracking-[0.2em] uppercase text-primary mb-3">
                          {a.category}
                        </span>
                      )}
                      <h2 className="font-heading text-lg font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                        {a.title}
                      </h2>
                      <p className="text-sm text-muted-foreground font-body leading-relaxed mb-4 flex-1">
                        {a.excerpt}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground font-body">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(a.published_at)}
                        </span>
                        {a.read_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {a.read_time}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Blog;
