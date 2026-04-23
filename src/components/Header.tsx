import { useState, useEffect } from "react";
import { ShoppingBag, Menu, X, Search, User, LogOut, Shield } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/horen-logo.png";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

const Header = () => {
  const { totalItems, openCart } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdmin = async (uid: string) => {
      const { data } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
      setIsAdmin(!!data);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (session?.user) checkAdmin(session.user.id);
      else setIsAdmin(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) checkAdmin(session.user.id);
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
          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className="p-2.5 hover:bg-secondary rounded-xl transition-colors"
              title="Painel Admin"
            >
              <Shield className="w-5 h-5 text-primary" />
            </button>
          )}

          {user ? (
            <>
              <button
                onClick={() => navigate("/conta")}
                className="p-2.5 hover:bg-secondary rounded-xl transition-colors"
                title="Minha conta"
              >
                <User className="w-5 h-5 text-foreground" />
              </button>

              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  setUser(null);
                  setIsAdmin(false);
                }}
                className="p-2.5 hover:bg-secondary rounded-xl transition-colors"
                title="Sair"
              >
                <LogOut className="w-5 h-5 text-foreground" />
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate("/auth", { state: { redirectTo: "/conta" } })}
              className="p-2.5 hover:bg-secondary rounded-xl transition-colors"
              title="Login"
            >
              <User className="w-5 h-5 text-foreground" />
            </button>
          )}

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
