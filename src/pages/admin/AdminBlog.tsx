import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Pencil, X, Sparkles, RefreshCw, Settings } from "lucide-react";

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  read_time: string | null;
  cover_image_url: string | null;
  content: string;
  published: boolean;
  published_at: string;
  sort_order: number;
  meta_description?: string | null;
  tags?: string[] | null;
  keywords?: string[] | null;
  status?: string | null;
  scheduled_at?: string | null;
  ai_generated?: boolean | null;
  ai_generated_at?: string | null;
};

const empty = (): Partial<Post> => ({
  slug: "",
  title: "",
  excerpt: "",
  category: "",
  read_time: "",
  cover_image_url: "",
  content: "",
  published: false,
  published_at: new Date().toISOString().slice(0, 10),
  sort_order: 0,
  meta_description: "",
  tags: [],
  keywords: [],
  status: "draft",
  scheduled_at: null,
  ai_generated: false,
});

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const AdminBlog = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Post> | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiCategory, setAiCategory] = useState("Creatina");
  const [aiTopic, setAiTopic] = useState("");
  const [automation, setAutomation] = useState<any>({
    enabled: false, word_count: 800, tone: "profissional",
    categories: ["Creatina","Whey","Hipertrofia"], publish_time: "08:00", auto_publish: false,
  });
  const [showSettings, setShowSettings] = useState(false);

  const loadAutomation = async () => {
    const { data } = await (supabase as any).from("blog_automation_settings").select("*").eq("id", 1).maybeSingle();
    if (data) setAutomation(data);
  };

  const saveAutomation = async () => {
    const payload = {
      id: 1,
      enabled: !!automation.enabled,
      word_count: Number(automation.word_count) || 800,
      tone: automation.tone || "profissional",
      categories: automation.categories || [],
      publish_time: automation.publish_time || "08:00",
      auto_publish: !!automation.auto_publish,
    };
    const { error } = await (supabase as any).from("blog_automation_settings").upsert(payload);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas");
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("blog_posts").select("*")
      .order("sort_order", { ascending: true })
      .order("published_at", { ascending: false });
    if (error) toast.error("Erro ao carregar posts");
    setPosts((data || []) as Post[]);
    setLoading(false);
  };

  useEffect(() => { load(); loadAutomation(); }, []);

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.title?.trim()) return toast.error("Informe o título");
    const slug = (editing.slug?.trim() || slugify(editing.title));
    setSaving(true);
    const payload = {
      slug,
      title: editing.title,
      excerpt: editing.excerpt || null,
      category: editing.category || null,
      read_time: editing.read_time || null,
      cover_image_url: editing.cover_image_url || null,
      content: editing.content || "",
      published: editing.published ?? true,
      published_at: editing.published_at
        ? new Date(editing.published_at).toISOString()
        : new Date().toISOString(),
      sort_order: Number(editing.sort_order) || 0,
      meta_description: editing.meta_description || null,
      tags: editing.tags || [],
      keywords: editing.keywords || [],
      status: editing.status || "draft",
      scheduled_at: editing.scheduled_at ? new Date(editing.scheduled_at).toISOString() : null,
      ai_generated: !!editing.ai_generated,
      ai_generated_at: editing.ai_generated_at || null,
    } as any;
    const db = supabase as any;
    const { error } = editing.id
      ? await db.from("blog_posts").update(payload).eq("id", editing.id)
      : await db.from("blog_posts").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Post salvo");
    setEditing(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este post?")) return;
    const { error } = await (supabase as any).from("blog_posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Post excluído");
    load();
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `blog/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("site-assets").upload(path, file);
    if (error) {
      setUploading(false);
      return toast.error("Falha no upload");
    }
    const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
    setEditing((p) => ({ ...(p || {}), cover_image_url: data.publicUrl }));
    setUploading(false);
    toast.success("Imagem carregada");
  };

  const handleGenerateAI = async () => {
    if (editing?.ai_generated && !confirm("Já existe um artigo gerado. Regenerar?")) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-blog", {
        body: {
          category: aiCategory || editing?.category || "Hipertrofia",
          topic: aiTopic,
          tone: automation.tone,
          word_count: automation.word_count,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha na IA");
      const c = data.content;
      const base = editing || empty();
      setEditing({
        ...base,
        title: c.title || base.title,
        slug: c.slug || slugify(c.title || ""),
        excerpt: c.excerpt || base.excerpt,
        category: c.category || aiCategory,
        read_time: c.read_time || base.read_time,
        content: c.content || "",
        meta_description: c.meta_description || "",
        tags: c.tags || [],
        keywords: c.keywords || [],
        ai_generated: true,
        ai_generated_at: data.generated_at,
        status: base.status || "draft",
      });
      setShowAiDialog(false);
      toast.success("Artigo gerado com IA!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Blog</h1>
          <p className="text-sm text-muted-foreground font-body">Crie, edite e publique artigos.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowSettings(!showSettings)} className="gap-2">
            <Settings className="w-4 h-4" /> Automação
          </Button>
          <Button variant="outline" onClick={() => { setEditing(empty()); setShowAiDialog(true); }} className="gap-2">
            <Sparkles className="w-4 h-4" /> Gerar com IA
          </Button>
          <Button onClick={() => setEditing(empty())} className="gap-2">
            <Plus className="w-4 h-4" /> Novo post
          </Button>
        </div>
      </div>

      {showSettings && (
        <Card className="p-6 mb-6 space-y-4">
          <h2 className="font-heading text-lg font-semibold flex items-center gap-2"><Settings className="w-4 h-4" /> Automação de blog com IA</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Switch checked={!!automation.enabled} onCheckedChange={(v) => setAutomation({ ...automation, enabled: v })} />
              <span className="text-sm">Automação ativa</span>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={!!automation.auto_publish} onCheckedChange={(v) => setAutomation({ ...automation, auto_publish: v })} />
              <span className="text-sm">Publicar automaticamente</span>
            </div>
            <div>
              <Label>Palavras por artigo</Label>
              <Input type="number" value={automation.word_count} onChange={(e) => setAutomation({ ...automation, word_count: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Tom</Label>
              <Input value={automation.tone} onChange={(e) => setAutomation({ ...automation, tone: e.target.value })} placeholder="profissional, casual, técnico..." />
            </div>
            <div>
              <Label>Horário de publicação</Label>
              <Input type="time" value={automation.publish_time?.slice(0,5) || "08:00"} onChange={(e) => setAutomation({ ...automation, publish_time: e.target.value })} />
            </div>
            <div>
              <Label>Categorias (vírgula)</Label>
              <Input value={(automation.categories || []).join(", ")} onChange={(e) => setAutomation({ ...automation, categories: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Para publicar automaticamente em horários definidos, configure um cron job que chame a edge function <code>ai-generate-blog</code>. As configurações acima são lidas pela automação.
          </p>
          <Button onClick={saveAutomation}>Salvar configurações</Button>
        </Card>
      )}

      {showAiDialog && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Gerar artigo com IA</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowAiDialog(false)}><X className="w-4 h-4" /></Button>
            </div>
            <div>
              <Label>Categoria</Label>
              <Input value={aiCategory} onChange={(e) => setAiCategory(e.target.value)} placeholder="Creatina, Whey, Hipertrofia..." />
            </div>
            <div>
              <Label>Tema (opcional)</Label>
              <Input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="Ex: como usar creatina antes do treino" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAiDialog(false)}>Cancelar</Button>
              <Button onClick={handleGenerateAI} disabled={aiLoading} className="gap-2">
                {aiLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Gerar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : posts.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Nenhum post ainda.</Card>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <Card key={p.id} className="p-4 flex items-center gap-4">
              {p.cover_image_url && (
                <img src={p.cover_image_url} alt="" className="w-16 h-16 object-cover rounded-md" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-heading font-semibold text-foreground truncate">{p.title}</h3>
                  {!p.published && (
                    <span className="text-[10px] uppercase bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                      {p.status === "scheduled" ? "Agendado" : "Rascunho"}
                    </span>
                  )}
                  {p.ai_generated && (
                    <span className="text-[10px] uppercase bg-primary/15 text-primary px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> IA
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{p.excerpt}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {p.category} · {new Date(p.published_at).toLocaleDateString("pt-BR")} · /{p.slug}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditing(p)} className="gap-2">
                <Pencil className="w-3.5 h-3.5" /> Editar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm overflow-y-auto">
          <div className="min-h-screen p-4 md:p-8 flex justify-center">
            <Card className="w-full max-w-3xl p-6 space-y-4 my-auto">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-xl font-bold">
                  {editing.id ? "Editar post" : "Novo post"}
                </h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowAiDialog(true)} className="gap-2">
                    <Sparkles className="w-3.5 h-3.5" /> {editing.ai_generated ? "Regenerar IA" : "Gerar com IA"}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setEditing(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {editing.ai_generated && editing.ai_generated_at && (
                <p className="text-[11px] text-primary uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Gerado por IA em {new Date(editing.ai_generated_at).toLocaleString("pt-BR")}
                </p>
              )}

              <div>
                <Label>Título</Label>
                <Input
                  value={editing.title || ""}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Slug (URL)</Label>
                  <Input
                    placeholder="auto a partir do título"
                    value={editing.slug || ""}
                    onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Input
                    value={editing.category || ""}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Tempo de leitura</Label>
                  <Input
                    placeholder="5 min"
                    value={editing.read_time || ""}
                    onChange={(e) => setEditing({ ...editing, read_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Data de publicação</Label>
                  <Input
                    type="date"
                    value={(editing.published_at || "").slice(0, 10)}
                    onChange={(e) => setEditing({ ...editing, published_at: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Resumo</Label>
                <Textarea
                  rows={2}
                  value={editing.excerpt || ""}
                  onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Meta description (SEO)</Label>
                  <Textarea rows={2} value={editing.meta_description || ""} onChange={(e) => setEditing({ ...editing, meta_description: e.target.value })} />
                </div>
                <div>
                  <Label>Tags (vírgula)</Label>
                  <Input value={(editing.tags || []).join(", ")} onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                </div>
                <div>
                  <Label>Palavras-chave (vírgula)</Label>
                  <Input value={(editing.keywords || []).join(", ")} onChange={(e) => setEditing({ ...editing, keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                </div>
                <div>
                  <Label>Status</Label>
                  <select
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    value={editing.status || "draft"}
                    onChange={(e) => setEditing({ ...editing, status: e.target.value, published: e.target.value === "published" })}
                  >
                    <option value="draft">Rascunho</option>
                    <option value="scheduled">Agendado</option>
                    <option value="published">Publicado</option>
                  </select>
                </div>
                {editing.status === "scheduled" && (
                  <div className="md:col-span-2">
                    <Label>Publicar em</Label>
                    <Input type="datetime-local" value={editing.scheduled_at ? new Date(editing.scheduled_at).toISOString().slice(0,16) : ""} onChange={(e) => setEditing({ ...editing, scheduled_at: e.target.value })} />
                  </div>
                )}
              </div>

              <div>
                <Label>Imagem de capa</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="URL da imagem"
                    value={editing.cover_image_url || ""}
                    onChange={(e) => setEditing({ ...editing, cover_image_url: e.target.value })}
                  />
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                    />
                    <span className="inline-flex items-center gap-2 px-3 h-10 border rounded-md cursor-pointer text-sm hover:bg-secondary">
                      <Upload className="w-4 h-4" /> {uploading ? "Enviando..." : "Enviar"}
                    </span>
                  </label>
                </div>
                {editing.cover_image_url && (
                  <img src={editing.cover_image_url} alt="" className="mt-2 max-h-40 rounded-md" />
                )}
              </div>

              <div>
                <Label>Conteúdo (Markdown)</Label>
                <p className="text-xs text-muted-foreground mb-1">
                  Use <code>## Título</code>, <code>### Subtítulo</code>, <code>- item</code>, <code>**negrito**</code>.
                </p>
                <Textarea
                  rows={16}
                  className="font-mono text-sm"
                  value={editing.content || ""}
                  onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={editing.published ?? true}
                    onCheckedChange={(v) => setEditing({ ...editing, published: v })}
                  />
                  <span className="text-sm">Publicado</span>
                </div>
                <div>
                  <Label className="text-xs">Ordem</Label>
                  <Input
                    type="number"
                    className="w-24"
                    value={editing.sort_order ?? 0}
                    onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminBlog;
