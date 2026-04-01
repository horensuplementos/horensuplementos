import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart, type CartProduct } from "@/contexts/CartContext";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

const ProductsSection = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });
      setProducts(data || []);
      setLoading(false);
    };
    fetchProducts();
  }, []);

  const formatPrice = (price: number) =>
    price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const toCartProduct = (p: Product): CartProduct => ({
    id: p.id,
    name: p.name,
    price: p.price,
    image_url: p.image_url,
    weight: p.weight,
    category: p.category,
  });

  return (
    <section id="produtos" className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-body tracking-[0.3em] uppercase text-muted-foreground mb-4">
            Nossos Produtos
          </p>
          <h2 className="font-heading text-4xl md:text-5xl font-bold text-foreground">
            Linha Premium
          </h2>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : products.length === 0 ? (
          <p className="text-center text-muted-foreground py-20">Nenhum produto disponível no momento.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {products.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: index * 0.15, duration: 0.5 }}
                className="group bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
              >
                <div
                  className="relative aspect-square bg-secondary overflow-hidden cursor-pointer"
                  onClick={() => navigate(`/produto/${product.id}`)}
                >
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag className="w-16 h-16 text-muted-foreground/30" />
                    </div>
                  )}
                  {product.category && (
                    <div className="absolute top-4 left-4">
                      <span className="bg-background/90 backdrop-blur-sm text-foreground text-xs font-body font-medium px-3 py-1.5 rounded-lg">
                        {product.category}
                      </span>
                    </div>
                  )}
                  {product.stock <= 0 && (
                    <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                      <span className="bg-destructive text-destructive-foreground text-sm font-bold px-4 py-2 rounded-lg">
                        Esgotado
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <h3
                    className="font-heading text-lg font-semibold text-foreground mb-1 cursor-pointer hover:text-primary transition-colors"
                    onClick={() => navigate(`/produto/${product.id}`)}
                  >
                    {product.name}
                  </h3>
                  {product.weight && (
                    <p className="text-sm text-muted-foreground mb-4">{product.weight}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="font-heading text-2xl font-bold text-primary">
                      {formatPrice(product.price)}
                    </span>
                    <Button
                      onClick={() => addItem(toCartProduct(product))}
                      size="sm"
                      disabled={product.stock <= 0}
                      className="rounded-xl gap-2 font-body"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      Comprar
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default ProductsSection;
