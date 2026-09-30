import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, GripVertical, ImagePlus, Package, Pencil, Plus, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
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
  image_urls: string[];
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
  shipping_width_cm: string;
  shipping_height_cm: string;
  shipping_length_cm: string;
  shipping_weight_kg: string;
}

const emptyForm: ProductForm = {
  name: "",
  description: "",
  price: "",
  stock: "0",
  category: "",
  weight: "",
  active: true,
  image_urls: [],
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
  shipping_width_cm: "20",
  shipping_height_cm: "10",
  shipping_length_cm: "30",
  shipping_weight_kg: "0.5",
};

const parseDecimal = (value: string) => {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
};

const AdminProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [removedImageUrls, setRemovedImageUrls] = useState<string[]>([]);
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
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

  const MAX_PRODUCT_IMAGES = 8;
  const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
  const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

  const moveImage = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= form.image_urls.length) return;
    setForm((prev) => {
      const image_urls = [...prev.image_urls];
      const [image] = image_urls.splice(fromIndex, 1);
      image_urls.splice(toIndex, 0, image);
      return { ...prev, image_urls };
    });
  };

  const uploadImages = async (files: File[]) => {
    const availableSlots = MAX_PRODUCT_IMAGES - form.image_urls.length;
    if (availableSlots <= 0) {
      toast({ title: `Limite de ${MAX_PRODUCT_IMAGES} imagens atingido.`, variant: "destructive" });
      return;
    }

    const selectedFiles = files.slice(0, availableSlots);
    const invalidFile = selectedFiles.find((file) => !acceptedImageTypes.has(file.type) || file.size > MAX_IMAGE_SIZE_BYTES);
    if (invalidFile) {
      toast({
        title: "Imagem inválida",
        description: "Envie JPG, PNG, WebP ou AVIF de até 5 MB por arquivo.",
        variant: "destructive",
      });
      return;
    }

    if (files.length > selectedFiles.length) {
      toast({ title: `Somente ${availableSlots} imagem(ns) foram adicionadas devido ao limite de ${MAX_PRODUCT_IMAGES}.` });
    }

    setUploading(true);
    try {
      const results = await Promise.all(selectedFiles.map(async (file) => {
        const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `products/${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage.from("product-images").upload(path, file, {
          upsert: false,
          contentType: file.type,
        });
        if (error) throw error;
        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        return data.publicUrl;
      }));
      setForm((prev) => ({ ...prev, image_urls: [...prev.image_urls, ...results] }));
    } catch (error: any) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleImageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length) void uploadImages(files);
  };

  const removeImage = (url: string) => {
    setForm((prev) => ({ ...prev, image_urls: prev.image_urls.filter((image) => image !== url) }));
    setRemovedImageUrls((prev) => prev.includes(url) ? prev : [...prev, url]);
  };

  const removeImagesFromStorage = async (urls: string[]) => {
    const paths = urls.flatMap((url) => {
      const marker = "/product-images/";
      const index = url.indexOf(marker);
      return index === -1 ? [] : [decodeURIComponent(url.slice(index + marker.length).split("?")[0])];
    });
    if (!paths.length) return;

    const { error } = await supabase.storage.from("product-images").remove(paths);
    if (error) {
      toast({ title: "Produto salvo, mas uma imagem não pôde ser removida", description: error.message, variant: "destructive" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const stockValue = form.stock.trim();
    if (!/^\d+$/.test(stockValue)) {
      toast({ title: "Estoque inválido", description: "O estoque não pode ser negativo.", variant: "destructive" });
      return;
    }
    const stockNum = Number(stockValue);
    const priceNum = parseDecimal(form.price);
    if (priceNum === null || priceNum < 0) {
      toast({ title: "Preço inválido", description: "O preço não pode ser negativo.", variant: "destructive" });
      return;
    }
    const logistics = [form.shipping_width_cm, form.shipping_height_cm, form.shipping_length_cm, form.shipping_weight_kg].map(parseDecimal);
    if (logistics.some((value) => value === null || value <= 0)) {
      toast({ title: "Dados logísticos inválidos", description: "Informe dimensões e peso maiores que zero, usando vírgula ou ponto para decimais.", variant: "destructive" });
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
      image_urls: form.image_urls,
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
      shipping_width_cm: logistics[0]!,
      shipping_height_cm: logistics[1]!,
      shipping_length_cm: logistics[2]!,
      shipping_weight_kg: logistics[3]!,
    } as any;

    let saved = false;
    if (editingId) {
      const { error } = await supabase.from("products").update(payload).eq("id", editingId);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Produto atualizado!" });
        saved = true;
      }
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Produto criado!" });
        saved = true;
      }
    }

    setLoading(false);
    if (saved) {
      await removeImagesFromStorage(removedImageUrls);
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      setRemovedImageUrls([]);
      fetchProducts();
    }
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
      image_urls: Array.isArray(p.image_urls) && p.image_urls.length > 0
        ? p.image_urls
        : product.image_url ? [product.image_url] : [],
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
      shipping_width_cm: String(p.shipping_width_cm ?? 20),
      shipping_height_cm: String(p.shipping_height_cm ?? 10),
      shipping_length_cm: String(p.shipping_length_cm ?? 30),
      shipping_weight_kg: String(p.shipping_weight_kg ?? 0.5),
    });
    setEditingId(product.id);
    setRemovedImageUrls([]);
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
            setRemovedImageUrls([]);
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
            <button
              type="button"
              aria-label="Fechar formulário"
              onClick={() => { setShowForm(false); setEditingId(null); setRemovedImageUrls([]); }}
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </CardHeader>
          <CardContent>
            <form noValidate onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  type="text"
                  inputMode="decimal"
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
                  type="text"
                  inputMode="numeric"
                  className={inputClass}
                  value={form.stock}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d+$/.test(v)) setForm({ ...form, stock: v });
                  }}
                  required
                />
              </div>
              <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3 rounded-xl border border-border bg-secondary/30 p-4">
                <p className="col-span-full text-sm font-heading font-semibold text-foreground">Dados para cálculo de frete</p>
                {[
                  ["Largura (cm)", "shipping_width_cm"],
                  ["Altura (cm)", "shipping_height_cm"],
                  ["Comprimento (cm)", "shipping_length_cm"],
                  ["Peso (kg)", "shipping_weight_kg"],
                ].map(([label, key]) => (
                  <div key={key}>
                    <label className="text-xs font-body text-muted-foreground mb-1 block">{label}</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Ex: 20 ou 20,5"
                      className={inputClass}
                      value={form[key as keyof Pick<ProductForm, "shipping_width_cm" | "shipping_height_cm" | "shipping_length_cm" | "shipping_weight_kg">]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-body text-muted-foreground mb-1 block">Imagens do produto</label>
                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const files = Array.from(event.dataTransfer.files || []);
                    if (files.length) void uploadImages(files);
                  }}
                  className="rounded-xl border border-dashed border-border bg-secondary/30 p-4 transition-colors hover:border-primary/50"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-heading text-sm font-semibold text-foreground">Galeria de imagens</p>
                      <p className="mt-1 text-xs text-muted-foreground">Arraste até {MAX_PRODUCT_IMAGES} imagens aqui ou selecione os arquivos. A primeira é a imagem principal.</p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-body text-muted-foreground transition-colors hover:bg-muted">
                      {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                      {uploading ? "Enviando..." : "Selecionar imagens"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/avif"
                        multiple
                        className="hidden"
                        onChange={handleImageInput}
                        disabled={uploading}
                      />
                    </label>
                  </div>

                  {form.image_urls.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {form.image_urls.map((url, index) => (
                        <div
                          key={url}
                          draggable={!uploading}
                          onDragStart={(event) => {
                            setDraggedImageIndex(index);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/product-image-index", String(index));
                          }}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const files = Array.from(event.dataTransfer.files || []);
                            if (files.length) {
                              void uploadImages(files);
                              return;
                            }
                            const sourceIndex = event.dataTransfer.getData("text/product-image-index");
                            if (sourceIndex !== "") moveImage(Number(sourceIndex), index);
                            setDraggedImageIndex(null);
                          }}
                          onDragEnd={() => setDraggedImageIndex(null)}
                          className={`group relative aspect-square overflow-hidden rounded-xl border bg-card ${draggedImageIndex === index ? "border-primary opacity-60" : "border-border"}`}
                        >
                          <img src={url} alt={`Imagem ${index + 1} de ${form.name || "produto"}`} className="h-full w-full object-cover" />
                          {index === 0 && <span className="absolute left-2 top-2 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">Principal</span>}
                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-background/85 px-2 py-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                            <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            <div className="flex gap-1">
                              <button type="button" aria-label={`Mover imagem ${index + 1} para esquerda`} onClick={() => moveImage(index, index - 1)} disabled={index === 0} className="rounded p-1 text-foreground hover:bg-muted disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                              <button type="button" aria-label={`Mover imagem ${index + 1} para direita`} onClick={() => moveImage(index, index + 1)} disabled={index === form.image_urls.length - 1} className="rounded p-1 text-foreground hover:bg-muted disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                              <button type="button" aria-label={`Excluir imagem ${index + 1}`} onClick={() => removeImage(url)} className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
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
