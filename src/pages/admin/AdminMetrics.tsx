import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Package, ShoppingCart, TicketPercent } from "lucide-react";

type CouponSummary = {
  id: string | null;
  code: string | null;
  total_uses: number | null;
  total_discount_generated: number | null;
};

type CartMetrics = {
  carts_with_items: number | null;
  abandoned_carts: number | null;
  recovered_carts: number | null;
  converted_carts: number | null;
  abandoned_value: number | null;
  converted_value: number | null;
};

const AdminMetrics = () => {
  const [revenue, setRevenue] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [averageTicket, setAverageTicket] = useState(0);
  const [topCoupons, setTopCoupons] = useState<CouponSummary[]>([]);
  const [cartMetrics, setCartMetrics] = useState<CartMetrics | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      const [ordersRes, couponsRes, cartsRes] = await Promise.all([
        supabase.from("orders").select("total, status"),
        supabase.from("coupon_usage_summary").select("id, code, total_uses, total_discount_generated").order("total_uses", { ascending: false }).limit(5),
        supabase.from("cart_metrics_summary").select("*").maybeSingle(),
      ]);

      const validOrders = (ordersRes.data || []).filter((order) => order.status !== "cancelado");
      const nextRevenue = validOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
      setRevenue(nextRevenue);
      setOrdersCount(validOrders.length);
      setAverageTicket(validOrders.length ? nextRevenue / validOrders.length : 0);
      setTopCoupons((couponsRes.data || []) as CouponSummary[]);
      setCartMetrics((cartsRes.data || null) as CartMetrics | null);
    };

    fetchMetrics();
  }, []);

  const formatCurrency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const cards = [
    { label: "Faturamento", value: formatCurrency(revenue), icon: BarChart3 },
    { label: "Pedidos válidos", value: String(ordersCount), icon: ShoppingCart },
    { label: "Ticket médio", value: formatCurrency(averageTicket), icon: Package },
    { label: "Cupons ativos usados", value: String(topCoupons.filter((coupon) => Number(coupon.total_uses || 0) > 0).length), icon: TicketPercent },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Métricas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acompanhe vendas, uso de cupons e comportamento de carrinhos em um único lugar.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <Card key={card.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                <card.icon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="font-heading text-2xl font-bold text-foreground">{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Cupons com melhor desempenho</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topCoupons.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ainda não há uso de cupons registrado.</p>
              ) : (
                topCoupons.map((coupon) => (
                  <div key={coupon.id || coupon.code} className="flex items-center justify-between rounded-md border border-border bg-secondary/30 p-4">
                    <div>
                      <p className="font-medium text-foreground">{coupon.code || "Sem código"}</p>
                      <p className="text-xs text-muted-foreground">{Number(coupon.total_uses || 0)} uso(s)</p>
                    </div>
                    <p className="font-heading text-base font-semibold text-foreground">{formatCurrency(Number(coupon.total_discount_generated || 0))}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Saúde dos carrinhos</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {[
                { label: "Carrinhos com itens", value: cartMetrics?.carts_with_items || 0 },
                { label: "Abandonados", value: cartMetrics?.abandoned_carts || 0 },
                { label: "Recuperados", value: cartMetrics?.recovered_carts || 0 },
                { label: "Convertidos", value: cartMetrics?.converted_carts || 0 },
                { label: "Valor abandonado", value: formatCurrency(Number(cartMetrics?.abandoned_value || 0)) },
                { label: "Valor convertido", value: formatCurrency(Number(cartMetrics?.converted_value || 0)) },
              ].map((item) => (
                <div key={item.label} className="rounded-md border border-border bg-secondary/30 p-4">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-2 font-heading text-xl font-bold text-foreground">{item.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminMetrics;