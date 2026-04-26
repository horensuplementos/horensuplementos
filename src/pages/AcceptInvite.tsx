import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react";

type Status = "loading" | "needs_login" | "success" | "error" | "already";

const AcceptInvite = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const [permission, setPermission] = useState<string | null>(null);

  const accept = async () => {
    if (!token) {
      setStatus("error");
      setMessage("Link de convite inválido.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) {
      setStatus("needs_login");
      setMessage("Faça login ou crie uma conta para aceitar o convite.");
      return;
    }

    const { data, error } = await (supabase as any).rpc("accept_admin_invitation_by_token", {
      p_user_id: sessionData.session.user.id,
      p_token: token,
    });

    if (error) {
      setStatus("error");
      setMessage(error.message || "Erro ao aceitar convite.");
      return;
    }

    if (data?.accepted) {
      setPermission(data.permission_level || null);
      setStatus(data.message === "Convite já aceito." ? "already" : "success");
      setMessage(data.message || "Convite aceito com sucesso!");
      toast({ title: "Acesso liberado", description: "Você agora é administrador do site." });
    } else {
      setStatus("error");
      setMessage(data?.message || "Não foi possível aceitar o convite.");
    }
  };

  useEffect(() => {
    accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-heading text-xl flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Convite de Administrador
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Validando convite...
            </div>
          )}
          {status === "needs_login" && (
            <>
              <p className="text-sm text-muted-foreground">{message}</p>
              <Button
                className="w-full"
                onClick={() => navigate(`/auth?redirectTo=${encodeURIComponent(`/aceitar-convite?token=${token}`)}`)}
              >
                Fazer login / Criar conta
              </Button>
            </>
          )}
          {(status === "success" || status === "already") && (
            <>
              <div className="flex items-start gap-3 rounded-md bg-primary/10 p-4 text-primary">
                <CheckCircle2 className="h-5 w-5 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">{message}</p>
                  {permission && <p className="text-xs opacity-80">Nível: {permission}</p>}
                </div>
              </div>
              <Button className="w-full" onClick={() => navigate("/admin")}>
                Ir para o painel
              </Button>
            </>
          )}
          {status === "error" && (
            <>
              <div className="flex items-start gap-3 rounded-md bg-destructive/10 p-4 text-destructive">
                <AlertCircle className="h-5 w-5 mt-0.5" />
                <p className="text-sm">{message}</p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
                Voltar ao início
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvite;
