import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, ShoppingCart, LogOut, ChevronLeft, TicketPercent, FilePenLine, Users, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";

const navItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, access: "all" },
  { label: "Cupons", href: "/admin/cupons", icon: TicketPercent, access: "admin" },
  { label: "Produtos", href: "/admin/produtos", icon: Package, access: "admin" },
  { label: "Pedidos", href: "/admin/pedidos", icon: ShoppingCart, access: "orders" },
  { label: "Editor do Site", href: "/admin/editor", icon: FilePenLine, access: "content" },
  { label: "Administradores", href: "/admin/administradores", icon: Users, access: "admin" },
  { label: "Métricas", href: "/admin/metricas", icon: BarChart3, access: "all" },
] as const;

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { permissionLevel, canManageContent, canManageOrders, isAdminManager } = useAdminPermissions();

  const availableNavItems = navItems.filter((item) => {
    if (!permissionLevel) return false;
    if (item.access === "all") return true;
    if (item.access === "admin") return isAdminManager;
    if (item.access === "orders") return canManageOrders || isAdminManager;
    if (item.access === "content") return canManageContent || isAdminManager;
    return false;
  });

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="font-heading text-lg font-bold text-foreground">Painel Admin</h1>
          <p className="text-xs text-muted-foreground font-body mt-1">Horen Suplementos</p>
          {permissionLevel && (
            <p className="text-[11px] text-primary font-body uppercase tracking-[0.18em] mt-3">
              {permissionLevel === "admin" ? "Administrador" : permissionLevel === "operator" ? "Operador" : "Editor"}
            </p>
          )}
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {availableNavItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-body transition-colors",
                location.pathname === item.href
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-border space-y-1">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-body text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors w-full"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar ao site
          </button>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/auth");
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-body text-destructive hover:bg-destructive/10 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
};

export default AdminLayout;
