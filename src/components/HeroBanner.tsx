import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import banner1 from "@/assets/banner-1.jpg";
import banner2 from "@/assets/banner-2.jpg";
import banner3 from "@/assets/banner-3.jpg";

const slides = [
  {
    title: "Whey Isolado Horen",
    subtitle: "LANÇAMENTO",
    description: "30% OFF no nosso novo Whey Protein Isolado. Performance máxima com sabor premium.",
    cta: "Comprar agora",
    link: "#produtos",
    image: banner1,
  },
  {
    title: "Combo Performance",
    subtitle: "OFERTA ESPECIAL",
    description: "Whey + Creatina por apenas R$ 349,90. O kit perfeito para evoluir seus resultados.",
    cta: "Ver combo",
    link: "#produtos",
    image: banner2,
  },
  {
    title: "Kits Exclusivos",
    subtitle: "PROMOÇÃO",
    description: "Kits com frete grátis em compras acima de R$ 299. Receba sem custo de envio.",
    cta: "Aproveitar",
    link: "#produtos",
    image: banner3,
  },
];

const HeroBanner = () => {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % slides.length);
  }, []);

  const prev = useCallback(() => {
    setCurrent((p) => (p - 1 + slides.length) % slides.length);
  }, []);

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  return (
    <section id="inicio" className="relative w-full h-[70vh] md:h-[80vh] overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0"
        >
          <img
            src={slides[current].image}
            alt={slides[current].title}
            className="absolute inset-0 w-full h-full object-cover"
            width={1920}
            height={1080}
          />
          <div className="absolute inset-0 bg-background/70" />

          <div className="relative h-full flex items-center">
            <div className="container mx-auto px-6 md:px-20">
              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-primary font-body text-xs md:text-sm tracking-[0.3em] uppercase mb-4"
              >
                {slides[current].subtitle}
              </motion.p>
              <motion.h2
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="font-heading text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 max-w-2xl"
              >
                {slides[current].title}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-muted-foreground font-body text-base md:text-lg max-w-lg mb-8"
              >
                {slides[current].description}
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
              >
                <Button
                  asChild
                  size="lg"
                  className="rounded-xl px-10 h-14 font-heading text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-transform"
                >
                  <a href={slides[current].link}>{slides[current].cta}</a>
                </Button>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation arrows - positioned at far edges */}
      <button
        onClick={prev}
        className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-card/20 backdrop-blur-sm hover:bg-card/40 transition-colors"
      >
        <ChevronLeft className="w-4 h-4 text-foreground" />
      </button>
      <button
        onClick={next}
        className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-card/20 backdrop-blur-sm hover:bg-card/40 transition-colors"
      >
        <ChevronRight className="w-4 h-4 text-foreground" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === current ? "w-8 bg-primary" : "w-2 bg-foreground/30"
            }`}
          />
        ))}
      </div>
    </section>
  );
};

export default HeroBanner;
