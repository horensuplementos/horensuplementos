import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Upload, X } from "lucide-react";
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
};

const AdminProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
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
    setLoading(true);

    const payload = {
      name: form.name,
      description: form.description || null,
      price: parseFloat(form.price),
      stock: parseInt(form.stock),
      category: form.category || null,
      weight: form.weight || null,
      active: form.active,
      image_url: form.image_url || null,
    };

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
    setForm({
      name: product.name,
      description: product.description || "",
      price: String(product.price),
      stock: String(product.stock),
      category: product.category || "",
      weight: product.weight || "",
      active: product.active,
      image_url: product.image_url || "",
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
                <label className="text-sm font-body text-muted-foreground mb-1 block">Estoque *</label>
                <input
                  type="number"
                  className={inputClass}
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
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
