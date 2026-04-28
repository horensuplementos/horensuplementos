import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { FilePenLine, RefreshCw, Save, Upload } from "lucide-react";
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
  items: unknown[];
  active: boolean;
};

const AdminContentEditor = () => {
  const { toast } = useToast();
  const { refreshSections } = useSiteContent();
  const [sections, setSections] = useState<SiteSection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    description: "",
    cta_label: "",
    cta_link: "",
    image_url: "",
    items: "[]",
    active: true,
  });

  const selectedSection = useMemo(
    () => sections.find((section) => section.id === selectedId) || null,
    [sections, selectedId]
  );

  const syncForm = (section: SiteSection | null) => {
    setForm({
      title: section?.title || "",
      subtitle: section?.subtitle || "",
      description: section?.description || "",
      cta_label: section?.cta_label || "",
      cta_link: section?.cta_link || "",
      image_url: section?.image_url || "",
      items: JSON.stringify(section?.items || [], null, 2),
      active: section?.active ?? true,
    });
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

    let parsedItems: unknown[] = [];
    try {
      const candidate = form.items.trim() ? JSON.parse(form.items) : [];
      parsedItems = Array.isArray(candidate) ? candidate : [];
    } catch {
      toast({ title: "JSON inválido", description: "Revise o campo de itens antes de salvar.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      title: form.title || null,
      subtitle: form.subtitle || null,
      description: form.description || null,
      cta_label: form.cta_label || null,
      cta_link: form.cta_link || null,
      image_url: form.image_url || null,
      items: parsedItems,
      active: form.active,
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

    toast({ title: "Conteúdo atualizado" });
    fetchSections();
    refreshSections();
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `sections/${selectedSection?.section_key || "geral"}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("site-assets").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
      setForm((prev) => ({ ...prev, image_url: data.publicUrl }));
      toast({ title: "Imagem enviada", description: "Lembre-se de salvar a seção." });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Editor do site</h1>
            <p className="mt-1 text-sm text-muted-foreground">Edite títulos, descrições, CTAs, imagens e listas das seções públicas.</p>
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

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Seções</CardTitle>
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
                  const active = selectedId === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setSelectedId(section.id)}
                      className={`w-full rounded-md border p-4 text-left transition-colors ${
                        active ? "border-primary bg-secondary text-foreground" : "border-border bg-card text-muted-foreground hover:bg-secondary/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-heading text-sm font-semibold capitalize">{section.section_key.replace(/_/g, " ")}</p>
                          <p className="mt-1 text-xs">{section.title || "Sem título definido"}</p>
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
                {selectedSection ? `Editando ${selectedSection.section_key.replace(/_/g, " ")}` : "Selecione uma seção"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedSection ? (
                <div className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  Escolha uma seção ao lado para começar.
                </div>
              ) : (
                <div className="grid gap-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground">Título</label>
                      <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground">Subtítulo</label>
                      <Input value={form.subtitle} onChange={(e) => setForm((prev) => ({ ...prev, subtitle: e.target.value }))} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Descrição</label>
                    <Textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} rows={5} />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground">Texto do botão</label>
                      <Input value={form.cta_label} onChange={(e) => setForm((prev) => ({ ...prev, cta_label: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground">Link do botão</label>
                      <Input value={form.cta_link} onChange={(e) => setForm((prev) => ({ ...prev, cta_link: e.target.value }))} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">URL da imagem</label>
                    <Input value={form.image_url} onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value }))} />
                    <div className="flex items-center gap-3">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-xs text-foreground hover:bg-secondary/70">
                        <Upload className="h-4 w-4" />
                        {uploading ? "Enviando..." : "Enviar imagem do computador"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {form.image_url && (
                        <img src={form.image_url} alt="preview" className="h-12 w-12 rounded object-cover border border-border" />
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Itens da seção (JSON)</label>
                    <Textarea value={form.items} onChange={(e) => setForm((prev) => ({ ...prev, items: e.target.value }))} rows={12} className="font-mono text-xs" />
                  </div>

                  <div className="flex items-center justify-between rounded-md border border-border bg-secondary/40 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Seção visível no site</p>
                      <p className="text-xs text-muted-foreground">Desative apenas se quiser ocultar essa área do site.</p>
                    </div>
                    <Switch checked={form.active} onCheckedChange={(value) => setForm((prev) => ({ ...prev, active: value }))} />
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