import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp, Package, Truck, Loader2, Copy } from "lucide-react";

const statusOptions = ["pendente", "pago", "enviado", "entregue", "cancelado"];
const statusColors: Record<string, string> = {
  pendente: "bg-yellow-500/20 text-yellow-400",
  pago: "bg-green-500/20 text-green-400",
  enviado: "bg-blue-500/20 text-blue-400",
  entregue: "bg-emerald-500/20 text-emerald-400",
  cancelado: "bg-red-500/20 text-red-400",
};

const AdminOrders = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, any[]>>({});
  const [shippingLoading, setShippingLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    setOrders(data || []);
  };

  useEffect(() => {
    fetchOrders();
    const channel = supabase
      .channel("admin-orders-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchOrders();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const toggleExpand = async (orderId: string) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
      return;
    }
    setExpandedOrder(orderId);
    if (!orderItems[orderId]) {
      const { data } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);
      setOrderItems((prev) => ({ ...prev, [orderId]: data || [] }));
    }
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus } as any)
      .eq("id", orderId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Status atualizado para "${newStatus}"` });
    }
  };

  const generateLabel = async (order: any) => {
    if (!order.shipping_service_id) {
      toast({ title: "Sem dados de frete", description: "Este pedido não tem frete selecionado.", variant: "destructive" });
      return;
    }

    setShippingLoading(order.id);
    try {
      // Parse address
      const addressParts = (order.customer_address || "").split(",").map((s: string) => s.trim());
      const street = addressParts[0] || "Rua";
      const numberMatch = (addressParts[1] || "").match(/(\d+)/);
      const number = numberMatch?.[1] || "S/N";
      const neighborhoodMatch = (addressParts[1] || "").split("-").map((s: string) => s.trim());
      const neighborhood = neighborhoodMatch[1] || "Centro";
      const cityState = (addressParts[2] || "").split("-").map((s: string) => s.trim());
      const city = cityState[0] || "São Paulo";
      const state = cityState[1] || "SP";
      const cepMatch = (order.customer_address || "").match(/CEP:\s*([\d-]+)/);
      const postalCode = cepMatch?.[1]?.replace(/\D/g, "") || "00000000";

      const items = orderItems[order.id] || [];
      const products = items.map((item: any) => ({
        name: item.product_name,
        quantity: item.quantity,
        unitary_value: Number(item.unit_price),
      }));

      // Step 1: Add to cart
      const { data: cartData, error: cartError } = await supabase.functions.invoke("shipping-label", {
        body: {
          action: "add_to_cart",
          shipment: {
            service: order.shipping_service_id,
            from: {
              name: "Horen Suplementos",
              email: "contato@horen.com.br",
              postal_code: "02613000",
              address: "Rua Exemplo",
              number: "100",
              neighborhood: "Centro",
              city: "São Paulo",
              state_abbr: "SP",
            },
            to: {
              name: order.customer_name,
              email: order.customer_email,
              phone: order.customer_phone || undefined,
              document: order.customer_cpf || undefined,
              postal_code: postalCode,
              address: street,
              number,
              neighborhood,
              city,
              state_abbr: state,
            },
            products,
            volumes: [{
              height: 10,
              width: 20,
              length: 30,
              weight: 0.5,
            }],
          },
        },
      });

      if (cartError) throw cartError;
      
      const meOrderId = cartData?.data?.id;
      if (!meOrderId) {
        console.error("Cart response:", cartData);
        toast({ title: "Erro", description: "Não foi possível criar o envio no Melhor Envio.", variant: "destructive" });
        return;
      }

      // Save shipping order ID
      await supabase.from("orders").update({ 
        shipping_order_id: meOrderId,
        shipping_status: "no_carrinho",
      } as any).eq("id", order.id);

      // Step 2: Generate label
      const { data: genData, error: genError } = await supabase.functions.invoke("shipping-label", {
        body: { action: "generate", order_ids: [meOrderId] },
      });
      if (genError) throw genError;

      // Step 3: Checkout (purchase label)
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke("shipping-label", {
        body: { action: "checkout", order_ids: [meOrderId] },
      });
      if (checkoutError) throw checkoutError;

      // Extract tracking code
      const purchaseData = checkoutData?.data?.purchase || checkoutData?.data;
      let trackingCode = "";
      if (purchaseData?.orders) {
        const orderInfo = purchaseData.orders.find((o: any) => o.id === meOrderId);
        trackingCode = orderInfo?.tracking || "";
      }

      await supabase.from("orders").update({
        shipping_status: "etiqueta_gerada",
        tracking_code: trackingCode || null,
        status: "enviado",
      } as any).eq("id", order.id);

      toast({ title: "Etiqueta gerada com sucesso!", description: trackingCode ? `Rastreio: ${trackingCode}` : undefined });
    } catch (err: any) {
      console.error("Label generation error:", err);
      toast({ title: "Erro ao gerar etiqueta", description: err.message, variant: "destructive" });
    } finally {
      setShippingLoading(null);
    }
  };

  const formatPrice = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <AdminLayout>
      <h1 className="font-heading text-2xl font-bold text-foreground mb-8">Pedidos</h1>

      {orders.length === 0 ? (
        <div className="text-center py-20">
          <Package className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Nenhum pedido ainda.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardContent className="p-0">
                <button
                  onClick={() => toggleExpand(order.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-4 text-left">
                    <div>
                      <p className="font-heading font-semibold text-foreground">
                        {order.customer_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.customer_email} · {new Date(order.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColors[order.status] || ""}`}>
                      {order.status}
                    </span>
                    <span className="font-heading font-bold text-foreground">
                      {formatPrice(Number(order.total))}
                    </span>
                    {expandedOrder === order.id ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {expandedOrder === order.id && (
                  <div className="px-4 pb-4 border-t border-border pt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Cliente</p>
                        <p className="text-sm text-foreground">{order.customer_name}</p>
                        <p className="text-sm text-foreground">{order.customer_email}</p>
                        {order.customer_phone && (
                          <p className="text-sm text-foreground">{order.customer_phone}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Endereço</p>
                        <p className="text-sm text-foreground">
                          {order.customer_address || "Não informado"}
                        </p>
                      </div>
                    </div>

                    {/* Shipping info */}
                    {order.shipping_service_name && (
                      <div className="bg-secondary/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Truck className="w-3 h-3" /> Frete
                        </p>
                        <p className="text-sm text-foreground">
                          {order.shipping_service_name} — {formatPrice(Number(order.shipping_price || 0))}
                        </p>
                        {order.tracking_code && (
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-sm font-mono text-primary">{order.tracking_code}</p>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(order.tracking_code);
                                toast({ title: "Código copiado!" });
                              }}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        {order.shipping_status && (
                          <p className="text-xs text-muted-foreground mt-1">Status: {order.shipping_status}</p>
                        )}
                      </div>
                    )}

                    {orderItems[order.id] && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Itens do Pedido</p>
                        <div className="space-y-2">
                          {orderItems[order.id].map((item: any) => (
                            <div
                              key={item.id}
                              className="flex justify-between bg-secondary/50 rounded-lg p-3"
                            >
                              <span className="text-sm text-foreground">
                                {item.product_name} × {item.quantity}
                              </span>
                              <span className="text-sm font-semibold text-foreground">
                                {formatPrice(item.unit_price * item.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Atualizar Status</p>
                      <div className="flex flex-wrap gap-2">
                        {statusOptions.map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={order.status === s ? "default" : "outline"}
                            onClick={() => updateStatus(order.id, s)}
                            className="capitalize text-xs"
                          >
                            {s}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Label generation button */}
                    {order.status === "pago" && !order.shipping_order_id && order.shipping_service_id && (
                      <Button
                        onClick={() => generateLabel(order)}
                        disabled={shippingLoading === order.id}
                        className="w-full"
                      >
                        {shippingLoading === order.id ? (
                          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Gerando etiqueta...</>
                        ) : (
                          <><Truck className="w-4 h-4 mr-2" /> Gerar Etiqueta de Envio</>
                        )}
                      </Button>
                    )}

                    {order.payment_method && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Pagamento</p>
                        <p className="text-sm text-foreground capitalize">
                          {order.payment_method}
                          {order.payment_id && ` · ID: ${order.payment_id}`}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminOrders;
