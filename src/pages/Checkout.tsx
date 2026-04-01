import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import Header from "@/components/Header";
import CartDrawer from "@/components/CartDrawer";

const Checkout = () => {
  const { items, totalPrice, clearCart } = useCart();
  const [user, setUser] = useState<any>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast({ title: "Faça login para continuar", variant: "destructive" });
        navigate("/auth");
        return;
      }
      setUser(session.user);
      setForm((prev) => ({ ...prev, email: session.user.email || "" }));

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (profile) {
        setForm((prev) => ({
          ...prev,
          name: profile.name || "",
          phone: profile.phone || "",
          address: profile.address || "",
        }));
      }
    };
    loadUser();
  }, [navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    setLoading(true);

    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          total: totalPrice,
          customer_name: form.name,
          customer_email: form.email,
          customer_phone: form.phone || null,
          customer_address: form.address || null,
          status: "pendente",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        product_name: item.product.name,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      // Update profile
      await supabase
        .from("profiles")
        .update({
          name: form.name,
          phone: form.phone,
          address: form.address,
        })
        .eq("user_id", user.id);

      clearCart();
      toast({ title: "Pedido realizado com sucesso!" });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const inputClass =
    "w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm font-body text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-all";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CartDrawer />
      <div className="pt-20">
        <div className="container mx-auto px-6 py-12 max-w-2xl">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 font-body"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>

          <h1 className="font-heading text-3xl font-bold text-foreground mb-8">Checkout</h1>

          {items.length === 0 ? (
            <div className="text-center py-20">
              <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">Seu carrinho está vazio.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <h2 className="font-heading text-lg font-semibold text-foreground">Seus Dados</h2>
                <div>
                  <label className="text-sm font-body text-muted-foreground mb-1 block">Nome completo *</label>
                  <input
                    className={inputClass}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-body text-muted-foreground mb-1 block">E-mail</label>
                  <input className={inputClass} value={form.email} disabled />
                </div>
                <div>
                  <label className="text-sm font-body text-muted-foreground mb-1 block">Telefone</label>
                  <input
                    className={inputClass}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div>
                  <label className="text-sm font-body text-muted-foreground mb-1 block">Endereço completo *</label>
                  <textarea
                    className={inputClass + " min-h-[80px]"}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    required
                    placeholder="Rua, número, bairro, cidade, estado, CEP"
                  />
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6">
                <h2 className="font-heading text-lg font-semibold text-foreground mb-4">Resumo do Pedido</h2>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.product.id} className="flex justify-between text-sm">
                      <span className="text-foreground">
                        {item.product.name} × {item.quantity}
                      </span>
                      <span className="font-semibold text-foreground">
                        {formatPrice(item.product.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-border pt-3 flex justify-between">
                    <span className="font-heading font-bold text-foreground">Total</span>
                    <span className="font-heading text-xl font-bold text-primary">
                      {formatPrice(totalPrice)}
                    </span>
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-14 rounded-xl font-heading text-base font-semibold">
                {loading ? "Processando..." : "Finalizar Pedido"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Checkout;
