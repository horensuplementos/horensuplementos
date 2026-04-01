import { useState, useEffect } from "react";
import { ShoppingBag, Menu, X, Search, User, LogOut } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/horen-logo.png";
import { products } from "@/data/products";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

const Header = () => {
  const { totalItems, openCart } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleNavClick = (href: string) => {
    if (href === "/blog") {
      navigate("/blog");
      return;
    }
    const hash = href.replace("/", "");
    if (window.location.pathname !== "/") {
      navigate(href);
    } else if (hash === "#inicio") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const navLinks = [
    { label: "Início", href: "/#inicio" },
    { label: "Produtos", href: "/#produtos" },
    { label: "Sobre", href: "/#sobre" },
    { label: "Blog", href: "/blog" },
    { label: "Contato", href: "/#contato" },
  ];

  const filteredProducts = searchQuery.length > 1
    ? products.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
      <div className="container mx-auto px-6 h-20 flex items-center justify-between gap-4">
        <button onClick={() => navigate("/")} className="flex-shrink-0">
          <img src={logo} alt="Horen" className="h-7 w-auto" />
        </button>

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => handleNavClick(link.href)}
              className="text-sm font-body font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2.5 hover:bg-secondary rounded-xl transition-colors"
            >
              <Search className="w-5 h-5 text-foreground" />
            </button>

            <AnimatePresence>
              {searchOpen && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 280 }}
                  exit={{ opacity: 0, width: 0 }}
                  className="absolute right-0 top-full mt-2 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
                >
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Buscar produtos..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                      className="flex-1 bg-transparent text-sm font-body text-foreground placeholder:text-muted-foreground outline-none"
                    />
                  </div>
                  {filteredProducts.length > 0 && (
                    <div className="max-h-60 overflow-y-auto">
                      {filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            navigate(`/produto/${p.id}`);
                            setSearchOpen(false);
                            setSearchQuery("");
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-secondary transition-colors flex justify-between items-center"
                        >
                          <div>
                            <p className="text-sm font-heading font-semibold text-foreground">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.category}</p>
                          </div>
                          <span className="text-sm font-heading font-bold text-primary">
                            {p.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchQuery.length > 1 && filteredProducts.length === 0 && (
                    <p className="px-4 py-3 text-sm text-muted-foreground">Nenhum produto encontrado</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={openCart}
            className="relative p-2.5 hover:bg-secondary rounded-xl transition-colors"
          >
            <ShoppingBag className="w-5 h-5 text-foreground" />
            {totalItems > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center"
              >
                {totalItems}
              </motion.span>
            )}
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 hover:bg-secondary rounded-xl transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-card border-b border-border overflow-hidden"
          >
            <nav className="px-6 py-4 space-y-3">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleNavClick(link.href);
                  }}
                  className="block text-base font-body font-medium text-muted-foreground hover:text-primary transition-colors py-2 w-full text-left"
                >
                  {link.label}
                </button>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
