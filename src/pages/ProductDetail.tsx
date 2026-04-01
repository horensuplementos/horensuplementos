import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCart, type CartProduct } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShoppingBag, Minus, Plus } from "lucide-react";
import Header from "@/components/Header";
import CartDrawer from "@/components/CartDrawer";
import Footer from "@/components/Footer";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();
      setProduct(data);
      setLoading(false);
    };
    fetchProduct();
  }, [id]);

  const formatPrice = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const toCartProduct = (p: Product): CartProduct => ({
    id: p.id,
    name: p.name,
    price: p.price,
    image_url: p.image_url,
    weight: p.weight,
    category: p.category,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <CartDrawer />
        <div className="pt-20 flex flex-col items-center justify-center py-32">
          <p className="text-muted-foreground mb-4">Produto não encontrado.</p>
          <Button variant="outline" onClick={() => navigate("/")}>Voltar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CartDrawer />
      <div className="pt-20">
        <div className="container mx-auto px-6 py-12">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 font-body"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="aspect-square bg-secondary rounded-2xl overflow-hidden">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingBag className="w-24 h-24 text-muted-foreground/20" />
                </div>
              )}
            </div>

            <div className="flex flex-col justify-center">
              {product.category && (
                <span className="text-sm font-body tracking-wider uppercase text-muted-foreground mb-2">
                  {product.category}
                </span>
              )}
              <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-2">
                {product.name}
              </h1>
              {product.weight && (
                <p className="text-muted-foreground mb-4">{product.weight}</p>
              )}
              <p className="font-heading text-3xl font-bold text-primary mb-6">
                {formatPrice(product.price)}
              </p>

              {product.description && (
                <p className="text-muted-foreground leading-relaxed mb-8">
                  {product.description}
                </p>
              )}

              {product.stock > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setQty(Math.max(1, qty - 1))}
                      className="w-10 h-10 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-heading text-lg font-semibold w-8 text-center">{qty}</span>
                    <button
                      onClick={() => setQty(Math.min(product.stock, qty + 1))}
                      className="w-10 h-10 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-muted-foreground">{product.stock} em estoque</span>
                  </div>
                  <Button
                    onClick={() => {
                      for (let i = 0; i < qty; i++) addItem(toCartProduct(product));
                    }}
                    className="w-full h-14 rounded-xl font-heading text-base font-semibold gap-2"
                  >
                    <ShoppingBag className="w-5 h-5" />
                    Adicionar ao Carrinho
                  </Button>
                </div>
              ) : (
                <div className="bg-destructive/10 text-destructive rounded-xl p-4 text-center font-semibold">
                  Produto esgotado
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ProductDetail;
