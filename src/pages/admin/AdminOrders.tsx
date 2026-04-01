import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp, Package } from "lucide-react";

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
      .update({ status: newStatus })
      .eq("id", orderId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Status atualizado para "${newStatus}"` });
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
