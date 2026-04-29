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
import { Plus, Trash2, Upload, Pencil, X } from "lucide-react";

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
};

const empty = (): Partial<Post> => ({
  slug: "",
  title: "",
  excerpt: "",
  category: "",
  read_time: "",
  cover_image_url: "",
  content: "",
  published: true,
  published_at: new Date().toISOString().slice(0, 10),
  sort_order: 0,
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

  useEffect(() => { load(); }, []);

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
    };
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

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Blog</h1>
          <p className="text-sm text-muted-foreground font-body">Crie, edite e publique artigos.</p>
        </div>
        <Button onClick={() => setEditing(empty())} className="gap-2">
          <Plus className="w-4 h-4" /> Novo post
        </Button>
      </div>

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
                    <span className="text-[10px] uppercase bg-muted px-2 py-0.5 rounded-full text-muted-foreground">Rascunho</span>
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
                <Button variant="ghost" size="icon" onClick={() => setEditing(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

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
