import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

const promos = [
  { text: "🔥 LANÇAMENTO — Whey Isolado Horen com 30% OFF", link: "#produtos" },
  { text: "🎁 COMBO PERFORMANCE — Whey + Creatina por R$ 349,90", link: "#produtos" },
  { text: "🚚 FRETE GRÁTIS em compras acima de R$ 299", link: "#produtos" },
  { text: "⚡ KIT INICIANTE — 3 suplementos essenciais por R$ 449,90", link: "#produtos" },
];

const PromoBanner = () => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % promos.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-primary text-primary-foreground relative overflow-hidden">
      <div className="container mx-auto px-6 h-10 flex items-center justify-center">
        <button
          onClick={() => setCurrent((prev) => (prev - 1 + promos.length) % promos.length)}
          className="absolute left-4 p-1 hover:opacity-70 transition-opacity"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <AnimatePresence mode="wait">
          <motion.a
            key={current}
            href={promos[current].link}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="text-xs md:text-sm font-body font-medium tracking-wide hover:underline"
          >
            {promos[current].text}
          </motion.a>
        </AnimatePresence>

        <button
          onClick={() => setCurrent((prev) => (prev + 1) % promos.length)}
          className="absolute right-4 p-1 hover:opacity-70 transition-opacity"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default PromoBanner;
