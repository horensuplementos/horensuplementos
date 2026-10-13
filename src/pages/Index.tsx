import Header from "@/components/Header";
import HeroBanner from "@/components/HeroBanner";
import ProductsSection from "@/components/ProductsSection";
import AboutSection from "@/components/AboutSection";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CartDrawer />
      <main>
        <h1 className="sr-only">Horen Suplementos — suplementação de alta performance</h1>
        <div className="pt-20">
          <HeroBanner />
        </div>
        <ProductsSection />
        <AboutSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
