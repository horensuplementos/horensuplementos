import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Store } from "lucide-react";

interface SiteSettings {
  local_pickup_enabled: boolean;
  pickup_address: string | null;
  pickup_instructions: string | null;
}

const DEFAULT_SETTINGS: SiteSettings = {
  local_pickup_enabled: false,
  pickup_address: "",
  pickup_instructions: "",
};

const AdminSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("site_settings" as any)
      .select("local_pickup_enabled, pickup_address, pickup_instructions")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      toast({ title: "Erro ao carregar configurações", description: error.message, variant: "destructive" });
    } else if (data) {
      setSettings({
        local_pickup_enabled: !!(data as any).local_pickup_enabled,
        pickup_address: (data as any).pickup_address || "",
        pickup_instructions: (data as any).pickup_instructions || "",
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const update = async (next: SiteSettings, silent = false) => {
    setSaving(true);
    const { error } = await supabase
      .from("site_settings" as any)
      .upsert({
        id: 1,
        local_pickup_enabled: next.local_pickup_enabled,
        pickup_address: next.pickup_address?.trim() || null,
        pickup_instructions: next.pickup_instructions?.trim() || null,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: "id" });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      await load();
      return;
    }
    if (!silent) toast({ title: "Configurações atualizadas" });
  };

  const handleToggle = async (checked: boolean) => {
    const next = { ...settings, local_pickup_enabled: checked };
    setSettings(next);
    await update(next, true);
    toast({
      title: checked ? "Retirada na loja ativada" : "Retirada na loja desativada",
      description: checked
        ? "Os clientes podem escolher esta opção no checkout."
        : "A opção foi removida do checkout.",
    });
  };

  return (
    <AdminLayout>
      <h1 className="font-heading text-2xl font-bold text-foreground mb-2">Configurações</h1>
      <p className="text-muted-foreground mb-8 font-body text-sm">
        Ajuste opções globais do site, como métodos de entrega.
      </p>

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Store className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle className="font-heading">Retirada na Loja</CardTitle>
                <CardDescription>
                  Permita que clientes em São Paulo retirem o pedido pessoalmente, sem custo de frete.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-xl border border-border p-4">
                  <div>
                    <Label htmlFor="pickup-toggle" className="font-medium text-foreground">
                      Ativar Retirada na Loja
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Aparece como opção de entrega no checkout.
                    </p>
                  </div>
                  <Switch
                    id="pickup-toggle"
                    checked={settings.local_pickup_enabled}
                    onCheckedChange={handleToggle}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pickup-address">Endereço da loja (exibido ao cliente)</Label>
                  <Input
                    id="pickup-address"
                    value={settings.pickup_address || ""}
                    onChange={(e) => setSettings({ ...settings, pickup_address: e.target.value })}
                    placeholder="Ex.: Rua Exemplo, 123 - Bairro, São Paulo/SP"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pickup-instructions">Instruções de retirada (opcional)</Label>
                  <Textarea
                    id="pickup-instructions"
                    value={settings.pickup_instructions || ""}
                    onChange={(e) => setSettings({ ...settings, pickup_instructions: e.target.value })}
                    placeholder="Horário de funcionamento, documentos necessários, etc."
                    rows={3}
                  />
                </div>

                <Button onClick={() => update(settings)} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar configurações"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;