import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, Clock3, Copy, CreditCard, Loader2, Package, Receipt, Truck, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type OrderRow = {
  id: string;
  created_at: string;
  status: string;
  total: number;
  customer_name: string;
  customer_email: string;
  payment_method: string | null;
  payment_id: string | null;
  shipping_service_name: string | null;
  shipping_price: number | null;
  shipping_status: string | null;
  tracking_code: string | null;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
};

const statusMeta: Record<string, { label: string; className: string; icon: typeof Clock3 }> = {
  pendente: { label: "Pendente", className: "bg-yellow-500/15 text-yellow-400", icon: Clock3 },
  aguardando_pagamento: { label: "Aguardando pagamento", className: "bg-amber-500/15 text-amber-300", icon: Clock3 },
  pago: { label: "Pagamento aprovado", className: "bg-emerald-500/15 text-emerald-400", icon: CheckCircle2 },
  enviado: { label: "Enviado", className: "bg-blue-500/15 text-blue-400", icon: Truck },
  entregue: { label: "Entregue", className: "bg-primary/15 text-primary", icon: Package },
  cancelado: { label: "Cancelado", className: "bg-destructive/15 text-destructive", icon: XCircle },
};

const AccountOrders = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItemRow[]>>({});
  const [retryingOrderId, setRetryingOrderId] = useState<string | null>(null);

  const fetchOrders = async (userId: string) => {
    const [{ data: profile }, { data: orderData, error: ordersError }] = await Promise.all([
      supabase.from("profiles").select("name").eq("user_id", userId).maybeSingle(),
      supabase
        .from("orders")
        .select("id, created_at, status, total, customer_name, customer_email, payment_method, payment_id, shipping_service_name, shipping_price, shipping_status, tracking_code")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    if (ordersError) throw ordersError;

    setUserName((profile as { name?: string } | null)?.name || "");
    const nextOrders = (orderData || []) as OrderRow[];
    setOrders(nextOrders);

    if (nextOrders.length === 0) {
      setOrderItems({});
      return;
    }

    const ids = nextOrders.map((order) => order.id);
    const { data: itemsData, error: itemsError } = await supabase
      .from("order_items")
      .select("id, order_id, product_name, quantity, unit_price")
      .in("order_id", ids);

    if (itemsError) throw itemsError;

    const grouped = (itemsData || []).reduce<Record<string, OrderItemRow[]>>((acc, item) => {
      const typedItem = item as OrderItemRow;
      acc[typedItem.order_id] = [...(acc[typedItem.order_id] || []), typedItem];
      return acc;
    }, {});

    setOrderItems(grouped);
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth", { replace: true, state: { redirectTo: "/conta" } });
        return;
      }

      try {
        await fetchOrders(session.user.id);
      } catch (error: any) {
        if (!mounted) return;
        toast({ title: "Erro ao carregar pedidos", description: error.message, variant: "destructive" });
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    const channel = supabase
      .channel("account-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) await fetchOrders(session.user.id);
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [navigate, toast]);

  const totalOrders = orders.length;
  const approvedOrders = useMemo(() => orders.filter((order) => ["pago", "enviado", "entregue"].includes(order.status)).length, [orders]);

  const formatPrice = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const canRetryPayment = (status: string) => ["pendente", "aguardando_pagamento", "falha"].includes(status);

  const retryPayment = async (orderId: string) => {
    setRetryingOrderId(orderId);
    const { data, error } = await supabase.functions.invoke("create-payment", { body: { order_id: orderId } });
    setRetryingOrderId(null);

    const paymentUrl = data?.checkout_url || data?.init_point || data?.sandbox_init_point;

    if (error || !paymentUrl) {
      toast({
        title: "Não foi possível gerar o pagamento",
        description: error?.message || "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
      return;
    }

    window.location.href = paymentUrl;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="pt-24 pb-12">
        <div className="container mx-auto max-w-5xl px-6">
          <button
            onClick={() => navigate("/")}
            className="mb-8 flex items-center gap-2 text-sm font-body text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar à loja
          </button>

          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 text-xs font-body uppercase tracking-[0.18em] text-primary">Minha conta</p>
              <h1 className="font-heading text-3xl font-bold text-foreground">
                {userName ? `Pedidos de ${userName}` : "Histórico de pedidos"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-body text-muted-foreground">
                Acompanhe o status dos pagamentos, veja rastreio e retome pagamentos pendentes sem precisar refazer o pedido.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:min-w-[260px]">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-body text-muted-foreground">Pedidos</p>
                  <p className="mt-2 font-heading text-2xl font-bold text-foreground">{totalOrders}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-body text-muted-foreground">Pagos</p>
                  <p className="mt-2 font-heading text-2xl font-bold text-foreground">{approvedOrders}</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[240px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : orders.length === 0 ? (
            <Card>
              <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-4 text-center">
                <Receipt className="h-12 w-12 text-muted-foreground/40" />
                <div>
                  <h2 className="font-heading text-xl font-semibold text-foreground">Nenhum pedido encontrado</h2>
                  <p className="mt-2 text-sm font-body text-muted-foreground">Quando você comprar, seus pedidos aparecerão aqui com pagamento, rastreio e atualizações.</p>
                </div>
                <Button onClick={() => navigate("/#produtos")}>Ver produtos</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const meta = statusMeta[order.status] || statusMeta.pendente;
                const StatusIcon = meta.icon;

                return (
                  <Card key={order.id}>
                    <CardHeader className="gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
                      <div>
                        <CardTitle className="font-heading text-xl text-foreground">Pedido #{order.id.slice(0, 8)}</CardTitle>
                        <CardDescription className="mt-2 text-sm font-body text-muted-foreground">
                          Feito em {new Date(order.created_at).toLocaleString("pt-BR")}
                        </CardDescription>
                      </div>

                      <div className="flex flex-col items-start gap-3 sm:items-end">
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${meta.className}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {meta.label}
                        </span>
                        <p className="font-heading text-xl font-bold text-foreground">{formatPrice(Number(order.total))}</p>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-6 pt-6">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-lg border border-border bg-secondary/35 p-4">
                          <p className="text-xs font-body text-muted-foreground">Pagamento</p>
                          <p className="mt-2 text-sm font-medium text-foreground">
                            {order.payment_method || (["pago", "enviado", "entregue"].includes(order.status) ? "Pago" : "Aguardando confirmação")}
                          </p>
                          {order.payment_id && <p className="mt-1 break-all text-xs text-muted-foreground">ID: {order.payment_id}</p>}
                        </div>

                        <div className="rounded-lg border border-border bg-secondary/35 p-4">
                          <p className="text-xs font-body text-muted-foreground">Entrega</p>
                          <p className="mt-2 text-sm font-medium text-foreground">{order.shipping_service_name || "Frete não informado"}</p>
                          {order.shipping_status && <p className="mt-1 text-xs text-muted-foreground">Status do envio: {order.shipping_status}</p>}
                        </div>

                        <div className="rounded-lg border border-border bg-secondary/35 p-4">
                          <p className="text-xs font-body text-muted-foreground">Rastreamento</p>
                          {order.tracking_code ? (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="font-mono text-sm text-foreground">{order.tracking_code}</span>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => {
                                  navigator.clipboard.writeText(order.tracking_code || "");
                                  toast({ title: "Código de rastreio copiado" });
                                }}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <p className="mt-2 text-sm text-muted-foreground">Disponível quando o pedido for postado.</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="mb-3 text-xs font-body uppercase tracking-[0.16em] text-muted-foreground">Itens do pedido</p>
                        <div className="space-y-2">
                          {(orderItems[order.id] || []).map((item) => (
                            <div key={item.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                              <div>
                                <p className="text-sm font-medium text-foreground">{item.product_name}</p>
                                <p className="text-xs text-muted-foreground">Quantidade: {item.quantity}</p>
                              </div>
                              <p className="text-sm font-semibold text-foreground">{formatPrice(Number(item.unit_price) * Number(item.quantity))}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                          {canRetryPayment(order.status)
                            ? "Seu pedido está salvo. Você pode retomar o pagamento agora."
                            : "Seu pedido continua disponível aqui para acompanhamento."}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {canRetryPayment(order.status) && (
                            <Button onClick={() => retryPayment(order.id)} disabled={retryingOrderId === order.id}>
                              {retryingOrderId === order.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Gerando pagamento...
                                </>
                              ) : (
                                <>
                                  <CreditCard className="h-4 w-4" />
                                  Tentar pagar novamente
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountOrders;