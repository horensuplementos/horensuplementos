import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Clock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";

type StatusType = "sucesso" | "falha" | "pendente";

const statusConfig: Record<StatusType, { icon: typeof CheckCircle2; title: string; description: string; color: string }> = {
  sucesso: {
    icon: CheckCircle2,
    title: "Pagamento aprovado!",
    description: "Seu pedido foi confirmado e está sendo preparado.",
    color: "text-green-500",
  },
  falha: {
    icon: XCircle,
    title: "Pagamento não aprovado",
    description: "Houve um problema com o pagamento. Tente novamente ou escolha outro método.",
    color: "text-red-500",
  },
  pendente: {
    icon: Clock,
    title: "Pagamento pendente",
    description: "Estamos aguardando a confirmação do seu pagamento. Assim que aprovado, seu pedido será processado.",
    color: "text-yellow-500",
  },
};

interface CheckoutStatusProps {
  type: StatusType;
}

const CheckoutStatus = ({ type }: CheckoutStatusProps) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get("order_id");
  const [order, setOrder] = useState<any>(null);

  const config = statusConfig[type];
  const Icon = config.icon;

  useEffect(() => {
    if (!orderId) return;
    supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single()
      .then(({ data }) => setOrder(data));
  }, [orderId]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="pt-20">
        <div className="container mx-auto px-6 py-16 max-w-lg text-center">
          <Icon className={`w-20 h-20 mx-auto mb-6 ${config.color}`} />
          <h1 className="font-heading text-2xl font-bold text-foreground mb-3">
            {config.title}
          </h1>
          <p className="text-muted-foreground font-body mb-6">
            {config.description}
          </p>

          {order && (
            <div className="bg-card border border-border rounded-2xl p-6 text-left mb-8 space-y-2">
              <p className="text-sm text-muted-foreground">
                Pedido: <span className="font-mono text-foreground">{order.id?.slice(0, 8)}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Total: <span className="font-bold text-foreground">
                  {Number(order.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                Status: <span className="font-semibold text-foreground capitalize">{order.status}</span>
              </p>
            </div>
          )}

          <div className="space-y-3">
            <Button onClick={() => navigate("/")} className="w-full rounded-xl">
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar à loja
            </Button>
            {type === "falha" && orderId && (
              <Button
                variant="outline"
                className="w-full rounded-xl"
                onClick={async () => {
                  const { data } = await supabase.functions.invoke("create-payment", {
                    body: { order_id: orderId },
                  });
                  if (data?.init_point) {
                    window.location.href = data.init_point;
                  }
                }}
              >
                Tentar pagar novamente
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutStatus;
