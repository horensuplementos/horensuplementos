import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShoppingBag, Loader2, Truck } from "lucide-react";
import Header from "@/components/Header";
import CartDrawer from "@/components/CartDrawer";

interface ShippingOption {
  id: number;
  name: string;
  company: string;
  price: number;
  delivery_time: number;
  currency: string;
}

interface AddressForm {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
}

const BRAZILIAN_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

const Checkout = () => {
  const { items, totalPrice, clearCart } = useCart();
  const [user, setUser] = useState<any>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    cpf: "",
  });
  const [address, setAddress] = useState<AddressForm>({
    street: "",
    number: "",
    neighborhood: "",
    city: "",
    state: "",
    zip_code: "",
  });
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
  const [loadingShipping, setLoadingShipping] = useState(false);
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
          name: (profile as any).name || "",
          phone: (profile as any).phone || "",
          cpf: (profile as any).cpf || "",
        }));
        setAddress({
          street: (profile as any).street || "",
          number: (profile as any).number || "",
          neighborhood: (profile as any).neighborhood || "",
          city: (profile as any).city || "",
          state: (profile as any).state || "",
          zip_code: (profile as any).zip_code || "",
        });
      }
    };
    loadUser();
  }, [navigate, toast]);

  const fetchAddressByCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast({ title: "CEP não encontrado", variant: "destructive" });
        return;
      }
      setAddress((prev) => ({
        ...prev,
        street: data.logradouro || prev.street,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));
    } catch {
      // silently fail
    }
  };

  const calculateShipping = async () => {
    const cleanZip = address.zip_code.replace(/\D/g, "");
    if (cleanZip.length !== 8) {
      toast({ title: "CEP inválido", description: "Informe um CEP com 8 dígitos.", variant: "destructive" });
      return;
    }
    if (items.length === 0) return;

    setLoadingShipping(true);
    setShippingOptions([]);
    setSelectedShipping(null);

    try {
      const products = items.map((item) => ({
        id: item.product.id,
        width: 20,
        height: 10,
        length: 30,
        weight: 0.5,
        quantity: item.quantity,
        insurance_value: item.product.price * item.quantity,
      }));

      const { data, error } = await supabase.functions.invoke("calculate-shipping", {
        body: { to_zip: cleanZip, products },
      });

      if (error) throw error;

      if (data?.options?.length > 0) {
        setShippingOptions(data.options);
      } else {
        toast({ title: "Nenhuma opção de frete encontrada", variant: "destructive" });
      }
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao calcular frete", description: err.message, variant: "destructive" });
    } finally {
      setLoadingShipping(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || !selectedShipping) return;
    setLoading(true);

    const fullAddress = `${address.street}, ${address.number} - ${address.neighborhood}, ${address.city} - ${address.state}, CEP: ${address.zip_code}`;

    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          total: totalPrice + selectedShipping.price,
          customer_name: form.name,
          customer_email: form.email,
          customer_phone: form.phone || null,
          customer_address: fullAddress,
          status: "pendente",
          shipping_service_id: selectedShipping.id,
          shipping_service_name: `${selectedShipping.company} - ${selectedShipping.name}`,
          shipping_price: selectedShipping.price,
        } as any)
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

      await supabase
        .from("profiles")
        .update({
          name: form.name,
          phone: form.phone,
          street: address.street,
          number: address.number,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
          zip_code: address.zip_code,
        } as any)
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

  const formatCEP = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    return digits;
  };

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
              {/* Dados pessoais */}
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
              </div>

              {/* Endereço */}
              <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <h2 className="font-heading text-lg font-semibold text-foreground">Endereço de Entrega</h2>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-sm font-body text-muted-foreground mb-1 block">CEP *</label>
                    <input
                      className={inputClass}
                      value={address.zip_code}
                      onChange={(e) => {
                        const formatted = formatCEP(e.target.value);
                        setAddress({ ...address, zip_code: formatted });
                        if (formatted.replace(/\D/g, "").length === 8) {
                          fetchAddressByCep(formatted);
                        }
                      }}
                      placeholder="00000-000"
                      required
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-[46px] rounded-xl"
                      onClick={calculateShipping}
                      disabled={loadingShipping}
                    >
                      {loadingShipping ? <Loader2 className="w-4 h-4 animate-spin" /> : "Calcular Frete"}
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-body text-muted-foreground mb-1 block">Rua *</label>
                  <input
                    className={inputClass}
                    value={address.street}
                    onChange={(e) => setAddress({ ...address, street: e.target.value })}
                    placeholder="Nome da rua"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-body text-muted-foreground mb-1 block">Número *</label>
                    <input
                      className={inputClass}
                      value={address.number}
                      onChange={(e) => setAddress({ ...address, number: e.target.value })}
                      placeholder="123"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-body text-muted-foreground mb-1 block">Bairro *</label>
                    <input
                      className={inputClass}
                      value={address.neighborhood}
                      onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })}
                      placeholder="Bairro"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-body text-muted-foreground mb-1 block">Cidade *</label>
                    <input
                      className={inputClass}
                      value={address.city}
                      onChange={(e) => setAddress({ ...address, city: e.target.value })}
                      placeholder="Cidade"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-body text-muted-foreground mb-1 block">Estado *</label>
                    <select
                      className={inputClass}
                      value={address.state}
                      onChange={(e) => setAddress({ ...address, state: e.target.value })}
                      required
                    >
                      <option value="">Selecione</option>
                      {BRAZILIAN_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Opções de frete */}
              {shippingOptions.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
                  <h2 className="font-heading text-lg font-semibold text-foreground flex items-center gap-2">
                    <Truck className="w-5 h-5" /> Opções de Frete
                  </h2>
                  {shippingOptions.map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedShipping?.id === opt.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="shipping"
                          checked={selectedShipping?.id === opt.id}
                          onChange={() => setSelectedShipping(opt)}
                          className="accent-primary"
                        />
                        <div>
                          <p className="font-body text-sm font-medium text-foreground">
                            {opt.company} - {opt.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Entrega em até {opt.delivery_time} dias úteis
                          </p>
                        </div>
                      </div>
                      <span className="font-heading font-bold text-foreground">
                        {formatPrice(opt.price)}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {/* Resumo */}
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
                  {selectedShipping && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Frete ({selectedShipping.name})</span>
                      <span className="font-semibold text-foreground">
                        {formatPrice(selectedShipping.price)}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-border pt-3 flex justify-between">
                    <span className="font-heading font-bold text-foreground">Total</span>
                    <span className="font-heading text-xl font-bold text-primary">
                      {formatPrice(totalPrice + (selectedShipping?.price || 0))}
                    </span>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !selectedShipping}
                className="w-full h-14 rounded-xl font-heading text-base font-semibold"
              >
                {loading ? "Processando..." : "Finalizar Pedido"}
              </Button>
              {!selectedShipping && shippingOptions.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">
                  Informe o CEP e calcule o frete para continuar.
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Checkout;
