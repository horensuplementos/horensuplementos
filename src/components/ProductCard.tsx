import { motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Product } from "@/data/products";
import { useCart } from "@/contexts/CartContext";
import { useNavigate } from "react-router-dom";

import productWhey from "@/assets/product-whey.jpg";
import productCreatina from "@/assets/product-creatina.jpg";
import productMulti from "@/assets/product-multi.jpg";

const imageMap: Record<string, string> = {
  "product-whey": productWhey,
  "product-creatina": productCreatina,
  "product-multi": productMulti,
};

interface ProductCardProps {
  product: Product;
  index: number;
}

const ProductCard = ({ product, index }: ProductCardProps) => {
  const { addItem } = useCart();
  const navigate = useNavigate();

  const formatPrice = (price: number) =>
    price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay: index * 0.15, duration: 0.5 }}
      className="group bg-card rounded-2xl overflow-hidden border border-border/50 hover:border-border transition-all duration-300 hover:shadow-lg"
    >
      <div
        className="relative aspect-square bg-muted overflow-hidden cursor-pointer"
        onClick={() => navigate(`/produto/${product.id}`)}
      >
        <img
          src={imageMap[product.image]}
          alt={product.name}
          loading="lazy"
          width={800}
          height={800}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-4 left-4">
          <span className="bg-card/90 backdrop-blur-sm text-foreground text-xs font-body font-medium px-3 py-1.5 rounded-lg">
            {product.category}
          </span>
        </div>
      </div>

      <div className="p-6">
        <p className="text-xs text-muted-foreground font-body tracking-wider uppercase mb-1">
          {product.subtitle}
        </p>
        <h3
          className="font-heading text-lg font-semibold text-foreground mb-1 cursor-pointer hover:text-accent transition-colors"
          onClick={() => navigate(`/produto/${product.id}`)}
        >
          {product.name}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">{product.weight}</p>

        <div className="flex items-center justify-between">
          <span className="font-heading text-2xl font-bold text-foreground">
            {formatPrice(product.price)}
          </span>
          <Button
            onClick={() => addItem(product)}
            size="sm"
            className="rounded-xl gap-2 font-body"
          >
            <ShoppingBag className="w-4 h-4" />
            Comprar
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;
