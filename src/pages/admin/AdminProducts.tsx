import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Upload, X, Package, Sparkles, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

interface ProductForm {
  name: string;
  description: string;
  price: string;
  stock: string;
  category: string;
  weight: string;
  active: boolean;
  image_url: string;
  brand: string;
  flavor: string;
  benefits_input: string;
  ingredients: string;
  ai_description_short: string;
  ai_description_long: string;
  ai_benefits: string[];
  ai_faq: { q: string; a: string }[];
  ai_meta_description: string;
  ai_keywords: string[];
  ai_generated: boolean;
  ai_generated_at: string | null;
  ai_history: any[];
}

const emptyForm: ProductForm = {
  name: "",
  description: "",
  price: "",
  stock: "0",
  category: "",
  weight: "",
  active: true,
  image_url: "",
  brand: "",
  flavor: "",
  benefits_input: "",
  ingredients: "",
  ai_description_short: "",
  ai_description_long: "",
  ai_benefits: [],
  ai_faq: [],
  ai_meta_description: "",
  ai_keywords: [],
  ai_generated: false,
  ai_generated_at: null,
  ai_history: [],
};

const AdminProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const { toast } = useToast();

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    setProducts(data || []);
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, file, { upsert: true });

    if (error) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
    setForm((prev) => ({ ...prev, image_url: urlData.publicUrl }));
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const stockNum = parseInt(form.stock);
    if (isNaN(stockNum) || stockNum < 0) {
      toast({ title: "Estoque inválido", description: "O estoque não pode ser negativo.", variant: "destructive" });
      return;
    }
    const priceNum = parseFloat(form.price);
    if (isNaN(priceNum) || priceNum < 0) {
      toast({ title: "Preço inválido", description: "O preço não pode ser negativo.", variant: "destructive" });
      return;
    }
    setLoading(true);

    const payload = {
      name: form.name,
      description: form.description || null,
      price: priceNum,
      stock: stockNum,
      category: form.category || null,
      weight: form.weight || null,
      active: form.active,
      image_url: form.image_url || null,
      brand: form.brand || null,
      flavor: form.flavor || null,
      benefits_input: form.benefits_input || null,
      ingredients: form.ingredients || null,
      ai_description_short: form.ai_description_short || null,
      ai_description_long: form.ai_description_long || null,
      ai_benefits: form.ai_benefits || [],
      ai_faq: form.ai_faq || [],
      ai_meta_description: form.ai_meta_description || null,
      ai_keywords: form.ai_keywords || [],
      ai_generated: form.ai_generated,
      ai_generated_at: form.ai_generated_at,
      ai_history: form.ai_history || [],
    } as any;

    if (editingId) {
      const { error } = await supabase.from("products").update(payload).eq("id", editingId);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Produto atualizado!" });
      }
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Produto criado!" });
      }
    }

    setLoading(false);
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    fetchProducts();
  };

  const handleEdit = (product: Product) => {
    const p = product as any;
    setForm({
      name: product.name,
      description: product.description || "",
      price: String(product.price),
      stock: String(product.stock),
      category: product.category || "",
      weight: product.weight || "",
      active: product.active,
      image_url: product.image_url || "",
      brand: p.brand || "",
      flavor: p.flavor || "",
      benefits_input: p.benefits_input || "",
      ingredients: p.ingredients || "",
      ai_description_short: p.ai_description_short || "",
      ai_description_long: p.ai_description_long || "",
      ai_benefits: p.ai_benefits || [],
      ai_faq: p.ai_faq || [],
      ai_meta_description: p.ai_meta_description || "",
      ai_keywords: p.ai_keywords || [],
      ai_generated: !!p.ai_generated,
      ai_generated_at: p.ai_generated_at || null,
      ai_history: p.ai_history || [],
    });
    setEditingId(product.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Produto excluído!" });
      fetchProducts();
    }
  };

  const handleGenerateAI = async () => {
    if (!form.name.trim()) {
      toast({ title: "Informe o nome do produto antes de gerar.", variant: "destructive" });
      return;
    }
    if (form.ai_generated && !confirm("Já existe uma descrição gerada por IA. Deseja regenerar e arquivar a versão atual?")) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-product", {
        body: {
          product_id: editingId,
          product: {
            name: form.name,
            brand: form.brand,
            weight: form.weight,
            flavor: form.flavor,
            category: form.category,
            benefits_input: form.benefits_input,
            ingredients: form.ingredients,
          },
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha na IA");
      const c = data.content;
      const prevSnapshot = form.ai_generated ? [{
        at: form.ai_generated_at,
        short: form.ai_description_short,
        long: form.ai_description_long,
      }, ...(form.ai_history || [])].slice(0, 5) : form.ai_history;
      setForm((prev) => ({
        ...prev,
        ai_description_short: c.description_short || "",
        ai_description_long: c.description_long || "",
        ai_benefits: Array.isArray(c.benefits) ? c.benefits : [],
        ai_faq: Array.isArray(c.faq) ? c.faq : [],
        ai_meta_description: c.meta_description || "",
        ai_keywords: Array.isArray(c.keywords) ? c.keywords : [],
        ai_generated: true,
        ai_generated_at: data.generated_at,
        ai_history: prevSnapshot,
        description: prev.description || c.description_long || "",
      }));
      toast({ title: "Descrição gerada com IA!" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar com IA", description: e.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const formatPrice = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const inputClass =
    "w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm font-body text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-all";

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-heading text-2xl font-bold text-foreground">Produtos</h1>
        <Button
          onClick={() => {
            setForm(emptyForm);
            setEditingId(null);
            setShowForm(true);
          }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Produto
        </Button>
      </div>

      {showForm && (
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading text-lg">
              {editingId ? "Editar Produto" : "Novo Produto"}
            </CardTitle>
            <button onClick={() => { setShowForm(false); setEditingId(null); }}>
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-body text-muted-foreground mb-1 block">Nome *</label>
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-body text-muted-foreground mb-1 block">Preço *</label>
                <input
                  type="number"
                  step="0.01"
                  className={inputClass}
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-body text-muted-foreground mb-1 block">Categoria</label>
                <input
                  className={inputClass}
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-body text-muted-foreground mb-1 block">Peso</label>
                <input
                  className={inputClass}
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                  placeholder="Ex: 300g"
                />
              </div>
              <div>
                <label className="text-sm font-body text-muted-foreground mb-1 block">Marca</label>
                <input className={inputClass} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Horen Suplementos" />
              </div>
              <div>
                <label className="text-sm font-body text-muted-foreground mb-1 block">Sabor</label>
                <input className={inputClass} value={form.flavor} onChange={(e) => setForm({ ...form, flavor: e.target.value })} placeholder="Ex: Morango" />
              </div>
              <div>
                <label className="text-sm font-body text-muted-foreground mb-1 block">Estoque *</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className={inputClass}
                  value={form.stock}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || parseInt(v) >= 0) setForm({ ...form, stock: v });
                  }}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-body text-muted-foreground mb-1 block">Imagem</label>
                <div className="flex gap-2">
                  <label className="flex items-center gap-2 px-4 py-3 bg-secondary border border-border rounded-xl cursor-pointer hover:bg-muted transition-colors text-sm font-body text-muted-foreground">
                    <Upload className="w-4 h-4" />
                    {uploading ? "Enviando..." : "Upload"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={uploading}
                    />
                  </label>
                  {form.image_url && (
                    <img
                      src={form.image_url}
                      alt="Preview"
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  )}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-body text-muted-foreground mb-1 block">Descrição</label>
                <textarea
                  className={inputClass + " min-h-[80px]"}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-body text-muted-foreground mb-1 block">Benefícios (para a IA, um por linha ou separados por vírgula)</label>
                <textarea className={inputClass + " min-h-[60px]"} value={form.benefits_input} onChange={(e) => setForm({ ...form, benefits_input: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-body text-muted-foreground mb-1 block">Ingredientes (opcional)</label>
                <textarea className={inputClass + " min-h-[60px]"} value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })} />
              </div>

              <div className="md:col-span-2 border border-border rounded-xl p-4 bg-secondary/40 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="font-heading text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Conteúdo gerado por IA</h3>
                    {form.ai_generated && form.ai_generated_at && (
                      <p className="text-[11px] text-muted-foreground mt-1">Gerado em {new Date(form.ai_generated_at).toLocaleString("pt-BR")} · {(form.ai_history?.length || 0) + 1}ª versão</p>
                    )}
                  </div>
                  <Button type="button" onClick={handleGenerateAI} disabled={aiLoading} className="gap-2">
                    {aiLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {form.ai_generated ? "Regenerar" : "Gerar descrição com IA"}
                  </Button>
                </div>

                {form.ai_generated && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Descrição curta</label>
                      <textarea className={inputClass + " min-h-[60px]"} value={form.ai_description_short} onChange={(e) => setForm({ ...form, ai_description_short: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Descrição longa</label>
                      <textarea className={inputClass + " min-h-[140px]"} value={form.ai_description_long} onChange={(e) => setForm({ ...form, ai_description_long: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Benefícios (um por linha)</label>
                      <textarea
                        className={inputClass + " min-h-[80px]"}
                        value={(form.ai_benefits || []).join("\n")}
                        onChange={(e) => setForm({ ...form, ai_benefits: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">FAQ (JSON)</label>
                      <textarea
                        className={inputClass + " min-h-[100px] font-mono text-xs"}
                        value={JSON.stringify(form.ai_faq || [], null, 2)}
                        onChange={(e) => { try { setForm({ ...form, ai_faq: JSON.parse(e.target.value) }); } catch {} }}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Meta description SEO</label>
                        <textarea className={inputClass + " min-h-[60px]"} value={form.ai_meta_description} onChange={(e) => setForm({ ...form, ai_meta_description: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Palavras-chave (vírgula)</label>
                        <input
                          className={inputClass}
                          value={(form.ai_keywords || []).join(", ")}
                          onChange={(e) => setForm({ ...form, ai_keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-primary uppercase tracking-wider">✨ Descrição gerada por IA</p>
                  </div>
                )}
              </div>

              <div className="md:col-span-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="active"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="active" className="text-sm font-body text-foreground">
                  Produto ativo (visível na loja)
                </label>
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Salvando..." : editingId ? "Atualizar Produto" : "Criar Produto"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {products.map((product) => (
          <Card key={product.id}>
            <CardContent className="flex items-center gap-4 p-4">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-16 h-16 rounded-xl object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center">
                  <Package className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-semibold text-foreground truncate">
                    {product.name}
                  </h3>
                  {!product.active && (
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                      Inativo
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatPrice(product.price)} · Estoque: {product.stock}
                  {product.category && ` · ${product.category}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => handleEdit(product)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => handleDelete(product.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {products.length === 0 && (
          <p className="text-center text-muted-foreground py-12">
            Nenhum produto cadastrado. Clique em "Novo Produto" para começar.
          </p>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminProducts;
