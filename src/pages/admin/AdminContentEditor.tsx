import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp, FilePenLine, Plus, RefreshCw, Save, Trash2, Upload } from "lucide-react";
import { useSiteContent } from "@/contexts/SiteContentContext";

type SiteSection = {
  id: string;
  section_key: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  cta_label: string | null;
  cta_link: string | null;
  image_url: string | null;
  items: any[];
  active: boolean;
};

type FieldType = "text" | "textarea" | "image" | "url";

type FieldDef = {
  key: string;
  label: string;
  helper?: string;
  type: FieldType;
  placeholder?: string;
};

type SectionSchema = {
  label: string;
  helper: string;
  baseFields: FieldDef[];
  itemsLabel?: string;
  itemsHelper?: string;
  itemTitle?: (item: any, idx: number) => string;
  itemFields?: FieldDef[];
  newItem?: () => Record<string, any>;
  maxItems?: number;
};

const SECTION_SCHEMAS: Record<string, SectionSchema> = {
  hero_banner: {
    label: "Banner principal (Hero)",
    helper: "Carrossel de slides no topo da home. Cada slide aparece por ~5s.",
    baseFields: [
      { key: "subtitle", label: "Etiqueta padrão (opcional)", helper: "Texto pequeno sobre o título — usado se um slide não tiver subtítulo.", type: "text" },
      { key: "title", label: "Título padrão (opcional)", helper: "Usado se um slide não tiver título.", type: "text" },
      { key: "description", label: "Descrição padrão (opcional)", type: "textarea" },
      { key: "cta_label", label: "Texto do botão padrão", type: "text" },
      { key: "cta_link", label: "Link do botão padrão", type: "url", placeholder: "#produtos" },
    ],
    itemsLabel: "Slides do carrossel",
    itemsHelper: "Cada item é um slide. Use a imagem de fundo ideal em alta resolução (1920x1080).",
    itemTitle: (item, idx) => item?.title || `Slide ${idx + 1}`,
    itemFields: [
      { key: "subtitle", label: "Etiqueta (texto pequeno acima do título)", type: "text", placeholder: "LANÇAMENTO" },
      { key: "title", label: "Título principal", type: "text", placeholder: "Whey Isolado Horen" },
      { key: "description", label: "Descrição", type: "textarea", placeholder: "30% OFF no nosso novo Whey..." },
      { key: "cta", label: "Texto do botão", type: "text", placeholder: "Comprar agora" },
      { key: "link", label: "Link do botão", type: "url", placeholder: "#produtos" },
      { key: "image_url", label: "Imagem de fundo", type: "image", helper: "Recomendado 1920x1080. Pode enviar do computador." },
    ],
    newItem: () => ({ title: "", subtitle: "", description: "", cta: "Comprar agora", link: "#produtos", image_url: "" }),
  },
  about_section: {
    label: "Seção Sobre",
    helper: "Bloco institucional com título, descrição e cards de valores.",
    baseFields: [
      { key: "subtitle", label: "Etiqueta (acima do título)", type: "text", placeholder: "Sobre a Horen" },
      { key: "title", label: "Título principal", type: "text" },
      { key: "description", label: "Descrição", type: "textarea" },
    ],
    itemsLabel: "Cards de valores",
    itemsHelper: "Aparecem em uma grade abaixo da descrição. Recomendado 4 cards.",
    itemTitle: (item, idx) => item?.title || `Card ${idx + 1}`,
    itemFields: [
      { key: "title", label: "Título do card", type: "text", placeholder: "Confiança" },
      { key: "description", label: "Descrição do card", type: "textarea" },
    ],
    newItem: () => ({ title: "", description: "" }),
  },
  promo_banner: {
    label: "Faixa promocional (topo)",
    helper: "Frases curtas no topo do site, alternando a cada 4s.",
    baseFields: [
      { key: "title", label: "Título interno (não aparece)", type: "text", helper: "Usado só para sua organização." },
    ],
    itemsLabel: "Mensagens da faixa",
    itemsHelper: "Cada mensagem aparece por alguns segundos. Mantenha curtas.",
    itemTitle: (item, idx) => item?.text?.slice(0, 60) || `Mensagem ${idx + 1}`,
    itemFields: [
      { key: "text", label: "Texto da mensagem", type: "text", placeholder: "🔥 Frete grátis acima de R$ 299" },
      { key: "link", label: "Link ao clicar", type: "url", placeholder: "#produtos" },
    ],
    newItem: () => ({ text: "", link: "#produtos" }),
  },
  products_section: {
    label: "Seção Produtos (cabeçalho)",
    helper: "Apenas o título e subtítulo acima da grade. Os produtos vêm do catálogo.",
    baseFields: [
      { key: "subtitle", label: "Etiqueta (acima do título)", type: "text", placeholder: "Nossos Produtos" },
      { key: "title", label: "Título principal", type: "text", placeholder: "Linha Premium" },
    ],
  },
  footer: {
    label: "Rodapé",
    helper: "Descrição da marca e lista de contatos no rodapé.",
    baseFields: [
      { key: "title", label: "Título interno (não aparece)", type: "text", helper: "Usado só para sua organização." },
      { key: "description", label: "Descrição da marca (parágrafo do rodapé)", type: "textarea" },
    ],
    itemsLabel: "Contatos",
    itemsHelper: "Lista exibida na coluna 'Contato'. Tipos válidos: email, phone, instagram.",
    itemTitle: (item, idx) => item?.label || `Contato ${idx + 1}`,
    itemFields: [
      { key: "type", label: "Tipo (email, phone ou instagram)", type: "text", placeholder: "email" },
      { key: "label", label: "Texto exibido", type: "text", placeholder: "contato@horen.com.br" },
      { key: "href", label: "Link (mailto:, tel: ou https://)", type: "url", placeholder: "mailto:contato@horen.com.br" },
    ],
    newItem: () => ({ type: "email", label: "", href: "" }),
  },
};

const defaultSchema: SectionSchema = {
  label: "Seção",
  helper: "",
  baseFields: [
    { key: "title", label: "Título", type: "text" },
    { key: "subtitle", label: "Subtítulo", type: "text" },
    { key: "description", label: "Descrição", type: "textarea" },
    { key: "cta_label", label: "Texto do botão", type: "text" },
    { key: "cta_link", label: "Link do botão", type: "url" },
  ],
};

const AdminContentEditor = () => {
  const { toast } = useToast();
  const { refreshSections } = useSiteContent();
  const [sections, setSections] = useState<SiteSection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const [base, setBase] = useState<Record<string, string>>({});
  const [items, setItems] = useState<Record<string, any>[]>([]);
  const [active, setActive] = useState(true);
  const [imageUrl, setImageUrl] = useState("");

  const selectedSection = useMemo(
    () => sections.find((section) => section.id === selectedId) || null,
    [sections, selectedId]
  );

  const schema: SectionSchema = useMemo(() => {
    if (!selectedSection) return defaultSchema;
    return SECTION_SCHEMAS[selectedSection.section_key] || defaultSchema;
  }, [selectedSection]);

  const syncForm = (section: SiteSection | null) => {
    if (!section) {
      setBase({});
      setItems([]);
      setActive(true);
      setImageUrl("");
      return;
    }
    setBase({
      title: section.title || "",
      subtitle: section.subtitle || "",
      description: section.description || "",
      cta_label: section.cta_label || "",
      cta_link: section.cta_link || "",
    });
    setImageUrl(section.image_url || "");
    setItems(Array.isArray(section.items) ? section.items.map((i) => ({ ...i })) : []);
    setActive(section.active);
  };

  const fetchSections = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("site_content_sections")
      .select("*")
      .order("section_key");

    if (error) {
      toast({ title: "Erro ao carregar editor", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const nextSections = (data || []) as SiteSection[];
    setSections(nextSections);

    const nextSelectedId = selectedId && nextSections.some((item) => item.id === selectedId)
      ? selectedId
      : nextSections[0]?.id || null;

    setSelectedId(nextSelectedId);
    syncForm(nextSections.find((item) => item.id === nextSelectedId) || null);
    setLoading(false);
  };

  useEffect(() => {
    fetchSections();
  }, []);

  useEffect(() => {
    syncForm(selectedSection);
  }, [selectedId]);

  const handleSave = async () => {
    if (!selectedSection) return;
    setSaving(true);
    const payload = {
      title: base.title || null,
      subtitle: base.subtitle || null,
      description: base.description || null,
      cta_label: base.cta_label || null,
      cta_link: base.cta_link || null,
      image_url: imageUrl || null,
      items,
      active,
    };

    const { error } = await (supabase as any)
      .from("site_content_sections")
      .update(payload)
      .eq("id", selectedSection.id);

    setSaving(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Conteúdo atualizado", description: "Recarregue a home para ver as alterações." });
    fetchSections();
    refreshSections();
  };

  const uploadImage = async (file: File, targetKey: string): Promise<string | null> => {
    setUploadingKey(targetKey);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `sections/${selectedSection?.section_key || "geral"}-${targetKey}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("site-assets").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
      return data.publicUrl;
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setUploadingKey(null);
    }
  };

  const renderField = (
    field: FieldDef,
    value: string,
    onChange: (v: string) => void,
    uploadKey: string
  ) => {
    if (field.type === "textarea") {
      return (
        <Textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={field.placeholder} />
      );
    }
    if (field.type === "image") {
      return (
        <div className="space-y-2">
          <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="Cole uma URL ou envie do computador" />
          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-xs text-foreground hover:bg-secondary/70">
              <Upload className="h-4 w-4" />
              {uploadingKey === uploadKey ? "Enviando..." : "Enviar do computador"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingKey === uploadKey}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  const url = await uploadImage(file, uploadKey);
                  if (url) onChange(url);
                }}
              />
            </label>
            {value && (
              <img src={value} alt="preview" className="h-12 w-20 rounded object-cover border border-border" />
            )}
          </div>
        </div>
      );
    }
    return <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />;
  };

  const updateItem = (idx: number, key: string, value: string) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
  };

  const addItem = () => {
    if (!schema.newItem) return;
    setItems((prev) => [...prev, schema.newItem!()]);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  return (
    <AdminLayout>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Editor do site</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Edite cada seção em campos visuais. Após salvar, recarregue a home para ver o resultado.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={fetchSections} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Atualizar
            </Button>
            <Button onClick={handleSave} disabled={!selectedSection || saving} className="gap-2">
              <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar seção"}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Seções do site</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando seções...</p>
              ) : sections.length === 0 ? (
                <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Nenhuma seção cadastrada.
                </div>
              ) : (
                sections.map((section) => {
                  const isActive = selectedId === section.id;
                  const sch = SECTION_SCHEMAS[section.section_key] || defaultSchema;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setSelectedId(section.id)}
                      className={`w-full rounded-md border p-4 text-left transition-colors ${
                        isActive ? "border-primary bg-secondary text-foreground" : "border-border bg-card text-muted-foreground hover:bg-secondary/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-heading text-sm font-semibold">{sch.label}</p>
                          <p className="mt-1 text-xs">{section.title || sch.helper}</p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${section.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          {section.active ? "Ativa" : "Oculta"}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <FilePenLine className="h-5 w-5 text-primary" />
                {selectedSection ? schema.label : "Selecione uma seção"}
              </CardTitle>
              {selectedSection && (
                <p className="text-xs text-muted-foreground">{schema.helper}</p>
              )}
            </CardHeader>
            <CardContent>
              {!selectedSection ? (
                <div className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  Escolha uma seção ao lado para começar.
                </div>
              ) : (
                <div className="grid gap-6">
                  {schema.baseFields.length > 0 && (
                    <div className="space-y-4 rounded-lg border border-border bg-secondary/20 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Campos principais</p>
                      <div className="grid gap-4">
                        {schema.baseFields.map((field) => (
                          <div key={field.key} className="space-y-1.5">
                            <label className="text-sm font-medium text-foreground">{field.label}</label>
                            {field.helper && <p className="text-xs text-muted-foreground">{field.helper}</p>}
                            {renderField(
                              field,
                              base[field.key] || "",
                              (v) => setBase((prev) => ({ ...prev, [field.key]: v })),
                              `base-${field.key}`
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {schema.itemFields && schema.itemsLabel && (
                    <div className="space-y-3 rounded-lg border border-border bg-secondary/20 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{schema.itemsLabel}</p>
                          {schema.itemsHelper && <p className="mt-1 text-xs text-muted-foreground">{schema.itemsHelper}</p>}
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={addItem} className="gap-2">
                          <Plus className="h-4 w-4" /> Adicionar
                        </Button>
                      </div>

                      {items.length === 0 ? (
                        <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                          Nenhum item ainda. Clique em "Adicionar" para criar o primeiro.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {items.map((item, idx) => (
                            <div key={idx} className="rounded-md border border-border bg-card p-4">
                              <div className="mb-3 flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-foreground">
                                  {schema.itemTitle ? schema.itemTitle(item, idx) : `Item ${idx + 1}`}
                                </p>
                                <div className="flex items-center gap-1">
                                  <Button type="button" variant="ghost" size="icon" onClick={() => moveItem(idx, -1)} disabled={idx === 0}>
                                    <ArrowUp className="h-4 w-4" />
                                  </Button>
                                  <Button type="button" variant="ghost" size="icon" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1}>
                                    <ArrowDown className="h-4 w-4" />
                                  </Button>
                                  <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                              <div className="grid gap-3">
                                {schema.itemFields!.map((field) => (
                                  <div key={field.key} className="space-y-1.5">
                                    <label className="text-xs font-medium text-foreground">{field.label}</label>
                                    {field.helper && <p className="text-[11px] text-muted-foreground">{field.helper}</p>}
                                    {renderField(
                                      field,
                                      item[field.key] || "",
                                      (v) => updateItem(idx, field.key, v),
                                      `item-${idx}-${field.key}`
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between rounded-md border border-border bg-secondary/40 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Seção visível no site</p>
                      <p className="text-xs text-muted-foreground">Desative apenas se quiser ocultar essa área.</p>
                    </div>
                    <Switch checked={active} onCheckedChange={setActive} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminContentEditor;