import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart, type CartProduct } from "@/contexts/CartContext";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import { useSiteSection } from "@/contexts/SiteContentContext";
import { getSectionText } from "@/lib/siteContent";

type Product = Tables<"products">;

const getProductImages = (product: Product) =>
  product.image_urls?.length ? product.image_urls : product.image_url ? [product.image_url] : [];

const ProductImageCarousel = ({ product, onOpen }: { product: Product; onOpen: () => void }) => {
  const images = getProductImages(product);
  const [current, setCurrent] = useState(0);
  const hasMultipleImages = images.length > 1;

  const showPrevious = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setCurrent((index) => (index - 1 + images.length) % images.length);
  };

  const showNext = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setCurrent((index) => (index + 1) % images.length);
  };

  return (
    <div className="relative aspect-square cursor-pointer overflow-hidden bg-secondary" onClick={onOpen}>
      {images.length ? (
        <img
          src={images[current]}
          alt={`${product.name} — imagem ${current + 1}`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <ShoppingBag className="h-16 w-16 text-muted-foreground/30" />
        </div>
      )}

      {hasMultipleImages && (
        <>
          <button
            type="button"
            onClick={showPrevious}
            aria-label={`Imagem anterior de ${product.name}`}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 text-foreground opacity-100 shadow-sm transition-opacity hover:bg-background sm:opacity-0 sm:group-hover:opacity-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={showNext}
            aria-label={`Próxima imagem de ${product.name}`}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 text-foreground opacity-100 shadow-sm transition-opacity hover:bg-background sm:opacity-0 sm:group-hover:opacity-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {images.map((image, index) => (
              <span key={image} className={`h-1.5 rounded-full transition-all ${index === current ? "w-4 bg-primary" : "w-1.5 bg-background/70"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const ProductsSection = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();
  const navigate = useNavigate();
  const { section, loading: contentLoading } = useSiteSection("products_section");
  const text = getSectionText(section, {
    subtitle: "Nossos Produtos",
    title: "Linha Premium",
  });

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
    stock: p.stock,
  });

  return (
    <section id="produtos" className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6">
        {contentLoading && !section ? (
          <div aria-busy="true" className="mx-auto mb-16 flex max-w-md animate-pulse flex-col items-center gap-4">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-12 w-64 rounded bg-muted" />
          </div>
        ) : <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-body tracking-[0.3em] uppercase text-muted-foreground mb-4">
            {text.subtitle}
          </p>
          <h2 className="font-heading text-4xl md:text-5xl font-bold text-foreground">
            {text.title}
          </h2>
        </motion.div>}

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
                <div className="relative">
                  <ProductImageCarousel product={product} onOpen={() => navigate(`/produto/${product.id}`)} />
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
