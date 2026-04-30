import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, ExternalLink, Copy } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/bling-oauth-callback`;

const AdminBling = () => {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [credId, setCredId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("bling_credentials")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (data) {
      setCredId(data.id);
      setClientId(data.client_id || "");
      setClientSecret(data.client_secret || "");
      setConnected(!!data.access_token);
      setExpiresAt(data.expires_at || null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveCredentials = async () => {
    if (!clientId || !clientSecret) {
      toast({ title: "Preencha Client ID e Secret", variant: "destructive" });
      return;
    }
    setSaving(true);
    if (credId) {
      await (supabase as any).from("bling_credentials").update({
        client_id: clientId, client_secret: clientSecret,
      }).eq("id", credId);
    } else {
      const { data } = await (supabase as any).from("bling_credentials").insert({
        client_id: clientId, client_secret: clientSecret,
      }).select().single();
      if (data) setCredId(data.id);
    }
    setSaving(false);
    toast({ title: "Credenciais salvas. Agora clique em Conectar." });
    load();
  };

  const connect = () => {
    if (!clientId) {
      toast({ title: "Salve o Client ID antes de conectar", variant: "destructive" });
      return;
    }
    const state = crypto.randomUUID();
    const url = `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&state=${state}`;
    window.location.href = url;
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  return (
    <AdminLayout>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Integração Bling</h1>
          <p className="text-muted-foreground font-body mt-1">Conecte sua conta Bling para emissão automática de NF-e.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Configure no Bling</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground font-body">
              Acesse{" "}
              <a href="https://developer.bling.com.br/aplicativos" target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 underline">
                developer.bling.com.br/aplicativos <ExternalLink className="w-3 h-3" />
              </a>{" "}
              e crie um aplicativo. Use a URL abaixo como <strong>Link de redirecionamento</strong>:
            </p>
            <div className="flex gap-2">
              <Input value={REDIRECT_URI} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copy(REDIRECT_URI, "URL")}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground font-body">
              Escopos recomendados: Notas Fiscais Eletrônicas, Pedidos de Vendas, Contatos.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Cole as credenciais do app Bling</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Client ID</Label>
              <Input value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={loading} />
            </div>
            <div>
              <Label>Client Secret</Label>
              <Input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} disabled={loading} />
            </div>
            <Button onClick={saveCredentials} disabled={saving}>
              {saving ? "Salvando..." : "Salvar credenciais"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              3. Conectar conta Bling
              {connected ? (
                <span className="inline-flex items-center gap-1 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Conectado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">
                  <AlertCircle className="w-3 h-3" /> Desconectado
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {connected && expiresAt && (
              <p className="text-xs text-muted-foreground font-body">
                Token expira em: {new Date(expiresAt).toLocaleString("pt-BR")} (renovado automaticamente)
              </p>
            )}
            <Button onClick={connect} className="bg-primary text-primary-foreground">
              {connected ? "Reconectar Bling" : "Conectar com Bling"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminBling;