import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ShoppingBag, Loader2, Truck, Plus, Pencil, Trash2, MapPin, Star, Check } from "lucide-react";
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
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
}

interface SavedAddress {
  id: string;
  label: string | null;
  recipient_name: string | null;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  is_default: boolean;
}

interface CouponValidationResult {
  valid: boolean;
  message?: string;
  coupon_id?: string;
  code?: string;
  description?: string;
  discount_amount?: number;
  discount_type?: "fixed" | "percentage" | "free_shipping";
  discount_value?: number;
  is_free_shipping?: boolean;
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
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zip_code: "",
  });
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressLabel, setAddressLabel] = useState<string>("");
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
  const [loadingShipping, setLoadingShipping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    coupon_id: string;
    code: string;
    description?: string;
    discount_amount: number;
    discount_type: "fixed" | "percentage" | "free_shipping";
    discount_value: number;
    is_free_shipping?: boolean;
  } | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const subtotal = totalPrice;
  const shippingTotal = selectedShipping?.price || 0;
  const discountAmount = appliedCoupon?.discount_type === "free_shipping"
    ? shippingTotal
    : appliedCoupon?.discount_amount || 0;
  const finalTotal = Math.max(subtotal + shippingTotal - discountAmount, 0);

  const loadSavedAddresses = async (userId: string, autoSelectId?: string | null) => {
    const { data, error } = await supabase
      .from("user_addresses" as any)
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }
    const list = (data || []) as unknown as SavedAddress[];
    setSavedAddresses(list);

    if (list.length === 0) {
      setSelectedAddressId(null);
      setShowAddressForm(true);
      return;
    }

    const target =
      (autoSelectId && list.find((a) => a.id === autoSelectId)) ||
      list.find((a) => a.is_default) ||
      list[0];

    if (target) selectAddress(target);
  };

  const selectAddress = (a: SavedAddress) => {
    setSelectedAddressId(a.id);
    setShowAddressForm(false);
    setEditingAddressId(null);
    setAddress({
      street: a.street,
      number: a.number,
      complement: a.complement || "",
      neighborhood: a.neighborhood,
      city: a.city,
      state: a.state,
      zip_code: a.zip_code,
    });
    setShippingOptions([]);
    setSelectedShipping(null);
  };

  const startNewAddress = () => {
    setEditingAddressId(null);
    setSelectedAddressId(null);
    setAddressLabel("");
    setAddress({
      street: "", number: "", complement: "",
      neighborhood: "", city: "", state: "", zip_code: "",
    });
    setShippingOptions([]);
    setSelectedShipping(null);
    setShowAddressForm(true);
  };

  const startEditAddress = (a: SavedAddress) => {
    setEditingAddressId(a.id);
    setSelectedAddressId(a.id);
    setAddressLabel(a.label || "");
    setAddress({
      street: a.street,
      number: a.number,
      complement: a.complement || "",
      neighborhood: a.neighborhood,
      city: a.city,
      state: a.state,
      zip_code: a.zip_code,
    });
    setShowAddressForm(true);
  };

  const saveAddress = async () => {
    if (!user) return;
    const cleanZip = address.zip_code.replace(/\D/g, "");
    if (!address.street.trim() || !address.number.trim() || !address.neighborhood.trim() ||
        !address.city.trim() || !address.state.trim() || cleanZip.length !== 8) {
      toast({ title: "Preencha o endereço completo", variant: "destructive" });
      return;
    }

    setSavingAddress(true);
    try {
      const payload: any = {
        user_id: user.id,
        label: addressLabel.trim() || null,
        street: address.street.trim(),
        number: address.number.trim(),
        complement: address.complement.trim() || null,
        neighborhood: address.neighborhood.trim(),
        city: address.city.trim(),
        state: address.state.trim(),
        zip_code: address.zip_code.trim(),
        is_default: savedAddresses.length === 0,
      };

      let savedId: string | null = null;
      if (editingAddressId) {
        const { error } = await supabase
          .from("user_addresses" as any)
          .update(payload)
          .eq("id", editingAddressId);
        if (error) throw error;
        savedId = editingAddressId;
      } else {
        const { data, error } = await supabase
          .from("user_addresses" as any)
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        savedId = (data as any)?.id || null;
      }

      toast({ title: editingAddressId ? "Endereço atualizado" : "Endereço salvo" });
      await loadSavedAddresses(user.id, savedId);
    } catch (err: any) {
      toast({ title: "Erro ao salvar endereço", description: err.message, variant: "destructive" });
    } finally {
      setSavingAddress(false);
    }
  };

  const deleteAddress = async (id: string) => {
    if (!confirm("Excluir este endereço?")) return;
    const { error } = await supabase.from("user_addresses" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Endereço excluído" });
    if (selectedAddressId === id) {
      setSelectedAddressId(null);
      setAddress({ street: "", number: "", complement: "", neighborhood: "", city: "", state: "", zip_code: "" });
    }
    if (user) await loadSavedAddresses(user.id);
  };

  const setAsDefault = async (id: string) => {
    const { error } = await supabase
      .from("user_addresses" as any)
      .update({ is_default: true })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Endereço padrão atualizado" });
    if (user) await loadSavedAddresses(user.id, id);
  };

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
      }

      await loadSavedAddresses(session.user.id);
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

  const validateCoupon = async () => {
    const normalizedCode = couponCode.trim().toUpperCase();
    if (!normalizedCode) {
      toast({ title: "Informe um cupom", variant: "destructive" });
      return;
    }

    setCouponLoading(true);
    const { data, error } = await supabase.rpc("validate_coupon", {
      p_code: normalizedCode,
      p_subtotal: subtotal,
    });
    const couponResult = data as unknown as CouponValidationResult | null;
    setCouponLoading(false);

    if (error) {
      toast({ title: "Erro ao validar cupom", description: error.message, variant: "destructive" });
      return;
    }

    if (!couponResult?.valid) {
      setAppliedCoupon(null);
      toast({ title: "Cupom inválido", description: couponResult?.message || "Não foi possível aplicar o cupom.", variant: "destructive" });
      return;
    }

    setAppliedCoupon({
      coupon_id: couponResult.coupon_id || "",
      code: couponResult.code || normalizedCode,
      description: couponResult.description || undefined,
      discount_amount: Number(couponResult.discount_amount || 0),
      discount_type: couponResult.discount_type || "fixed",
      discount_value: Number(couponResult.discount_value || 0),
      is_free_shipping: couponResult.is_free_shipping || false,
    });
    setCouponCode(couponResult.code || normalizedCode);
    toast({
      title: "Cupom aplicado!",
      description: couponResult.is_free_shipping
        ? "Frete grátis ativado para este pedido."
        : `Desconto de ${formatPrice(Number(couponResult.discount_amount || 0))}`,
    });
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || !selectedShipping) return;

    const normalizedName = form.name.replace(/\s+/g, " ").trim();
    const normalizedEmail = form.email.trim();
    const normalizedCpf = form.cpf.replace(/\D/g, "");

    if (normalizedName.split(" ").length < 2) {
      toast({ title: "Informe nome e sobrenome", variant: "destructive" });
      return;
    }

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      toast({ title: "Informe um e-mail válido", variant: "destructive" });
      return;
    }

    if (normalizedCpf.length !== 11) {
      toast({ title: "Informe um CPF válido", variant: "destructive" });
      return;
    }

    setLoading(true);

    const complementPart = address.complement ? ` (${address.complement})` : "";
    const fullAddress = `${address.street}, ${address.number}${complementPart} - ${address.neighborhood}, ${address.city} - ${address.state}, CEP: ${address.zip_code}`;

    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          subtotal_amount: subtotal,
          discount_amount: discountAmount,
          coupon_id: appliedCoupon?.coupon_id || null,
          coupon_code: appliedCoupon?.code || null,
          total: finalTotal,
          customer_name: normalizedName,
          customer_email: normalizedEmail,
          customer_phone: form.phone || null,
          customer_address: fullAddress,
          customer_cpf: normalizedCpf || null,
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
          cpf: form.cpf,
          street: address.street,
          number: address.number,
          complement: address.complement,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
          zip_code: address.zip_code,
        } as any)
        .eq("user_id", user.id);

      // Create Mercado Pago payment and redirect
      toast({ title: "Redirecionando para pagamento..." });

      const { data: paymentData, error: paymentError } = await supabase.functions.invoke(
        "create-payment",
        { body: { order_id: order.id } }
      );

      const paymentUrl = paymentData?.checkout_url || paymentData?.init_point || paymentData?.sandbox_init_point;

      if (paymentError || !paymentUrl) {
        console.error("Payment error:", paymentError, paymentData);
        toast({
          title: "Erro ao gerar pagamento",
          description: "O pedido foi criado mas houve um erro ao gerar o link de pagamento. Tente novamente na página do pedido.",
          variant: "destructive",
        });
        clearCart();
        navigate(`/checkout/pendente?order_id=${order.id}`);
        return;
      }

      clearCart();
      // Redirect to Mercado Pago checkout
      window.location.href = paymentUrl;
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
                <div>
                  <label className="text-sm font-body text-muted-foreground mb-1 block">CPF *</label>
                  <input
                    className={inputClass}
                    value={form.cpf}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                      let formatted = digits;
                      if (digits.length > 9) formatted = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
                      else if (digits.length > 6) formatted = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`;
                      else if (digits.length > 3) formatted = `${digits.slice(0,3)}.${digits.slice(3)}`;
                      setForm({ ...form, cpf: formatted });
                    }}
                    placeholder="000.000.000-00"
                    required
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
                <div>
                  <label className="text-sm font-body text-muted-foreground mb-1 block">
                    Complemento <span className="text-muted-foreground/70">(opcional)</span>
                  </label>
                  <input
                    className={inputClass}
                    value={address.complement}
                    onChange={(e) => setAddress({ ...address, complement: e.target.value })}
                    placeholder="Apartamento, bloco, casa, referência..."
                  />
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
                  <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
                    <div className="flex flex-col md:flex-row gap-3">
                      <Input
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="Cupom de desconto"
                        className="h-11"
                      />
                      <Button type="button" variant="outline" className="h-11 md:min-w-36" onClick={validateCoupon} disabled={couponLoading}>
                        {couponLoading ? "Validando..." : "Aplicar cupom"}
                      </Button>
                    </div>
                    {appliedCoupon && (
                      <div className="flex items-center justify-between gap-4 rounded-lg bg-background px-4 py-3 border border-border">
                        <div>
                          <p className="text-sm font-medium text-foreground">{appliedCoupon.code} aplicado</p>
                          <p className="text-xs text-muted-foreground">
                            {appliedCoupon.description || (appliedCoupon.discount_type === "percentage"
                              ? `${appliedCoupon.discount_value}% de desconto`
                              : appliedCoupon.discount_type === "free_shipping"
                                ? "Frete grátis neste pedido"
                                : `${formatPrice(appliedCoupon.discount_value)} de desconto`)}
                          </p>
                        </div>
                        <Button type="button" variant="ghost" onClick={removeCoupon}>Remover</Button>
                      </div>
                    )}
                  </div>
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
                        {appliedCoupon?.discount_type === "free_shipping" ? "Grátis" : formatPrice(selectedShipping.price)}
                      </span>
                    </div>
                  )}
                  {appliedCoupon && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {appliedCoupon.discount_type === "free_shipping" ? `Frete grátis (${appliedCoupon.code})` : `Desconto (${appliedCoupon.code})`}
                      </span>
                      <span className="font-semibold text-primary">- {formatPrice(discountAmount)}</span>
                    </div>
                  )}
                  <div className="border-t border-border pt-3 flex justify-between">
                    <span className="font-heading font-bold text-foreground">Total</span>
                    <span className="font-heading text-xl font-bold text-primary">
                      {formatPrice(finalTotal)}
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
