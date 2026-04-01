import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Package, ShoppingCart, TrendingUp } from "lucide-react";

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalProducts: 0,
    pendingOrders: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const [ordersRes, productsRes, pendingRes] = await Promise.all([
        supabase.from("orders").select("total, status"),
        supabase.from("products").select("id", { count: "exact" }),
        supabase.from("orders").select("id", { count: "exact" }).eq("status", "pendente"),
      ]);

      const orders = ordersRes.data || [];
      const paidOrders = orders.filter((o) => o.status !== "cancelado");
      const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);

      setStats({
        totalRevenue,
        totalOrders: orders.length,
        totalProducts: productsRes.count || 0,
        pendingOrders: pendingRes.count || 0,
      });

      const { data: recent } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentOrders(recent || []);
    };

    fetchStats();

    const channel = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchStats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const formatPrice = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const statusColors: Record<string, string> = {
    pendente: "bg-yellow-500/20 text-yellow-400",
    pago: "bg-green-500/20 text-green-400",
    enviado: "bg-blue-500/20 text-blue-400",
    entregue: "bg-emerald-500/20 text-emerald-400",
    cancelado: "bg-red-500/20 text-red-400",
  };

  const statCards = [
    { label: "Receita Total", value: formatPrice(stats.totalRevenue), icon: DollarSign },
    { label: "Pedidos", value: stats.totalOrders, icon: ShoppingCart },
    { label: "Produtos", value: stats.totalProducts, icon: Package },
    { label: "Pendentes", value: stats.pendingOrders, icon: TrendingUp },
  ];

  return (
    <AdminLayout>
      <h1 className="font-heading text-2xl font-bold text-foreground mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-body font-medium text-muted-foreground">
                {s.label}
              </CardTitle>
              <s.icon className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-heading font-bold text-foreground">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Pedidos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl"
                >
                  <div>
                    <p className="font-heading font-semibold text-sm text-foreground">
                      {order.customer_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColors[order.status] || ""}`}>
                      {order.status}
                    </span>
                    <span className="font-heading font-bold text-foreground">
                      {formatPrice(Number(order.total))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default Dashboard;
