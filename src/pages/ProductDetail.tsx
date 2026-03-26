import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ShoppingBag, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { products } from "@/data/products";
import { useCart } from "@/contexts/CartContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";

import productWhey from "@/assets/product-whey.jpg";
import productCreatina from "@/assets/product-creatina.jpg";
import productMulti from "@/assets/product-multi.jpg";

const imageMap: Record<string, string> = {
  "product-whey": productWhey,
  "product-creatina": productCreatina,
  "product-multi": productMulti,
};

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const product = products.find((p) => p.id === id);

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground mb-4">
            Produto não encontrado
          </h1>
          <Button onClick={() => navigate("/")} variant="outline" className="rounded-xl">
            Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  const formatPrice = (price: number) =>
    price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CartDrawer />

      <main className="pt-20">
        <div className="container mx-auto px-6 py-12">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 font-body"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar aos produtos
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              className="aspect-square rounded-2xl overflow-hidden bg-muted"
            >
              <img
                src={imageMap[product.image]}
                alt={product.name}
                width={800}
                height={800}
                className="w-full h-full object-cover"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="flex flex-col justify-center"
            >
              <span className="text-xs font-body tracking-[0.3em] uppercase text-muted-foreground mb-2">
                {product.category}
              </span>
              <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-2">
                {product.name}
              </h1>
              <p className="text-muted-foreground font-body text-sm mb-6">
                {product.weight}
              </p>

              <p className="text-foreground/80 font-body leading-relaxed mb-8">
                {product.description}
              </p>

              <div className="space-y-3 mb-8">
                {product.details.map((detail) => (
                  <div key={detail} className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-accent" />
                    <span className="text-sm font-body text-foreground/70">{detail}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-6">
                <span className="font-heading text-3xl font-bold text-foreground">
                  {formatPrice(product.price)}
                </span>
              </div>

              <Button
                onClick={() => addItem(product)}
                size="lg"
                className="mt-6 rounded-xl h-14 gap-3 font-heading text-base font-semibold w-full max-w-sm hover:scale-[1.02] transition-transform"
              >
                <ShoppingBag className="w-5 h-5" />
                Adicionar ao Carrinho
              </Button>

              <p className="text-xs text-muted-foreground mt-4 font-body">
                Frete grátis para compras acima de R$ 299,00
              </p>
            </motion.div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProductDetail;
