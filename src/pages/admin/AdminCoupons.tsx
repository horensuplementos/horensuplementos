import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Plus, TicketPercent, Trash2, X } from "lucide-react";

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  discount_type: "fixed" | "percentage" | "free_shipping";
  discount_value: number;
  minimum_order_amount: number;
  usage_limit: number | null;
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
};

type CouponSummary = {
  id: string;
  code: string;
  description: string | null;
  discount_type: "fixed" | "percentage" | "free_shipping";
  discount_value: number;
  minimum_order_amount: number;
  active: boolean;
  usage_limit: number | null;
  starts_at: string | null;
  expires_at: string | null;
  total_uses: number;
  total_discount_generated: number;
  last_used_at: string | null;
};

type CouponOrder = {
  id: string;
  customer_name: string;
  created_at: string;
  discount_amount: number;
  total: number;
  status: string;
  coupon_code: string | null;
};

type CouponForm = {
  code: string;
  description: string;
  discount_type: "fixed" | "percentage" | "free_shipping";
  discount_value: string;
  minimum_order_amount: string;
  usage_limit: string;
  starts_at: string;
  expires_at: string;
  active: boolean;
};

const emptyForm: CouponForm = {
  code: "",
  description: "",
  discount_type: "percentage",
  discount_value: "",
  minimum_order_amount: "0",
  usage_limit: "",
  starts_at: "",
  expires_at: "",
  active: true,
};

const AdminCoupons = () => {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<CouponSummary[]>([]);
  const [ordersByCoupon, setOrdersByCoupon] = useState<Record<string, CouponOrder[]>>({});
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const formatPrice = (value: number) =>
    Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const inputClass =
    "w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm font-body text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-all";

  const totals = useMemo(() => {
    return coupons.reduce(
      (acc, coupon) => {
        acc.totalUses += Number(coupon.total_uses || 0);
        acc.totalDiscount += Number(coupon.total_discount_generated || 0);
        if (coupon.active) acc.activeCoupons += 1;
        return acc;
      },
      { totalUses: 0, totalDiscount: 0, activeCoupons: 0 }
    );
  }, [coupons]);

  const fetchCoupons = async () => {
    const [{ data: couponData, error: couponError }, { data: ordersData, error: ordersError }] = await Promise.all([
      supabase.from("coupon_usage_summary").select("*").order("code"),
      supabase
        .from("orders")
        .select("id, customer_name, created_at, discount_amount, total, status, coupon_code, coupon_id")
        .not("coupon_id", "is", null)
        .order("created_at", { ascending: false }),
    ]);

    if (couponError || ordersError) {
      toast({
        title: "Erro ao carregar cupons",
        description: couponError?.message || ordersError?.message,
        variant: "destructive",
      });
      return;
    }

    setCoupons((couponData as CouponSummary[]) || []);
    const grouped = ((ordersData as Array<CouponOrder & { coupon_id: string }>) || []).reduce<Record<string, CouponOrder[]>>(
      (acc, order) => {
        if (!order.coupon_id) return acc;
        acc[order.coupon_id] = acc[order.coupon_id] || [];
        acc[order.coupon_id].push(order);
        return acc;
      },
      {}
    );
    setOrdersByCoupon(grouped);
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = async (couponId: string) => {
    const { data, error } = await supabase.from("coupons").select("*").eq("id", couponId).single();

    if (error || !data) {
      toast({ title: "Erro ao carregar cupom", description: error?.message, variant: "destructive" });
      return;
    }

    const coupon = data as Coupon;
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      description: coupon.description || "",
      discount_type: coupon.discount_type,
      discount_value: String(coupon.discount_value),
      minimum_order_amount: String(coupon.minimum_order_amount || 0),
      usage_limit: coupon.usage_limit ? String(coupon.usage_limit) : "",
      starts_at: coupon.starts_at ? coupon.starts_at.slice(0, 16) : "",
      expires_at: coupon.expires_at ? coupon.expires_at.slice(0, 16) : "",
      active: coupon.active,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

      const payload = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim() || null,
      discount_type: form.discount_type,
        discount_value: form.discount_type === "free_shipping" ? 0 : Number(form.discount_value),
      minimum_order_amount: Number(form.minimum_order_amount || 0),
      usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      active: form.active,
    };

    const query = editingId
      ? supabase.from("coupons").update(payload).eq("id", editingId)
      : supabase.from("coupons").insert(payload);

    const { error } = await query;
    setLoading(false);

    if (error) {
      toast({ title: "Erro ao salvar cupom", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: editingId ? "Cupom atualizado" : "Cupom criado" });
    resetForm();
    fetchCoupons();
  };

  const handleDelete = async (couponId: string) => {
    const { error } = await supabase.from("coupons").delete().eq("id", couponId);
    if (error) {
      toast({ title: "Erro ao excluir cupom", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Cupom excluído" });
    fetchCoupons();
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Cupons</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie descontos, limites de uso e acompanhe os resultados.</p>
        </div>
        <Button
          onClick={() => {
            setForm(emptyForm);
            setEditingId(null);
            setShowForm(true);
          }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo cupom
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-body font-medium text-muted-foreground">Cupons ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-heading font-bold text-foreground">{totals.activeCoupons}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-body font-medium text-muted-foreground">Usos totais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-heading font-bold text-foreground">{totals.totalUses}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-body font-medium text-muted-foreground">Desconto gerado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-heading font-bold text-foreground">{formatPrice(totals.totalDiscount)}</div>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading text-lg">{editingId ? "Editar cupom" : "Novo cupom"}</CardTitle>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-body text-muted-foreground mb-1 block">Código *</label>
                <Input className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required />
              </div>
              <div>
                <label className="text-sm font-body text-muted-foreground mb-1 block">Tipo de desconto *</label>
                <select className={inputClass} value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as "fixed" | "percentage" | "free_shipping" })}>
                  <option value="percentage">Percentual</option>
                  <option value="fixed">Valor fixo</option>
                  <option value="free_shipping">Frete grátis</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-body text-muted-foreground mb-1 block">Valor *</label>
                <Input type="number" step="0.01" min="0" className={inputClass} value={form.discount_type === "free_shipping" ? "0" : form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} required={form.discount_type !== "free_shipping"} disabled={form.discount_type === "free_shipping"} />
              </div>
              <div>
                <label className="text-sm font-body text-muted-foreground mb-1 block">Pedido mínimo</label>
                <Input type="number" step="0.01" min="0" className={inputClass} value={form.minimum_order_amount} onChange={(e) => setForm({ ...form, minimum_order_amount: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-body text-muted-foreground mb-1 block">Início da validade</label>
                <Input type="datetime-local" className={inputClass} value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-body text-muted-foreground mb-1 block">Fim da validade</label>
                <Input type="datetime-local" className={inputClass} value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-body text-muted-foreground mb-1 block">Limite de usos</label>
                <Input type="number" min="1" className={inputClass} value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} placeholder="Sem limite" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-body text-muted-foreground mb-1 block">Descrição</label>
                <textarea className={inputClass + " min-h-[84px]"} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <label className="md:col-span-2 flex items-center gap-3 text-sm text-foreground">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="rounded" />
                Cupom ativo para uso no checkout
              </label>
              <div className="md:col-span-2 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
                <Button type="submit" disabled={loading}>{loading ? "Salvando..." : editingId ? "Salvar alterações" : "Criar cupom"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {coupons.length === 0 ? (
        <div className="text-center py-20">
          <TicketPercent className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Nenhum cupom cadastrado ainda.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {coupons.map((coupon) => (
            <Card key={coupon.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="font-heading text-lg flex items-center gap-3">
                    {coupon.code}
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${coupon.active ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                      {coupon.active ? "Ativo" : "Inativo"}
                    </span>
                  </CardTitle>
                  {coupon.description && <p className="text-sm text-muted-foreground mt-2">{coupon.description}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(coupon.id)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(coupon.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground mb-1">Desconto</p>
                    <p className="font-heading font-bold text-foreground">
                        {coupon.discount_type === "percentage"
                          ? `${coupon.discount_value}%`
                          : coupon.discount_type === "free_shipping"
                            ? "Frete grátis"
                            : formatPrice(coupon.discount_value)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground mb-1">Usos</p>
                    <p className="font-heading font-bold text-foreground">
                      {coupon.total_uses}
                      {coupon.usage_limit ? <span className="text-sm text-muted-foreground"> / {coupon.usage_limit}</span> : null}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground mb-1">Desconto gerado</p>
                    <p className="font-heading font-bold text-foreground">{formatPrice(coupon.total_discount_generated)}</p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground mb-1">Último uso</p>
                    <p className="font-heading font-bold text-foreground text-sm">
                      {coupon.last_used_at ? new Date(coupon.last_used_at).toLocaleDateString("pt-BR") : "—"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Pedido mínimo</p>
                    <p className="text-foreground">{formatPrice(coupon.minimum_order_amount || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Validade</p>
                    <p className="text-foreground">
                      {coupon.starts_at ? new Date(coupon.starts_at).toLocaleDateString("pt-BR") : "Imediato"} — {coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString("pt-BR") : "Sem prazo"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Pedidos vinculados</p>
                    <p className="text-foreground">{ordersByCoupon[coupon.id]?.length || 0}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Histórico de uso</p>
                  <div className="space-y-2">
                    {(ordersByCoupon[coupon.id] || []).length === 0 ? (
                      <div className="rounded-lg bg-secondary/40 p-4 text-sm text-muted-foreground">Ainda não há pedidos usando este cupom.</div>
                    ) : (
                      ordersByCoupon[coupon.id].map((order) => (
                        <div key={order.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-lg bg-secondary/40 p-4">
                          <div>
                            <p className="text-sm font-medium text-foreground">{order.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString("pt-BR")} · Pedido {order.id.slice(0, 8)}</p>
                          </div>
                          <div className="text-sm md:text-right">
                            <p className="text-foreground">Desconto: <span className="font-semibold">{formatPrice(order.discount_amount)}</span></p>
                            <p className="text-muted-foreground">Total: {formatPrice(order.total)} · {order.status}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminCoupons;