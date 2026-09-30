import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import Index from "./pages/Index.tsx";
import ProductDetail from "./pages/ProductDetail.tsx";
import AdminRoute from "./components/AdminRoute.tsx";
import { SiteContentProvider } from "./contexts/SiteContentContext";

const Blog = lazy(() => import("./pages/Blog.tsx"));
const Calculators = lazy(() => import("./pages/Calculators.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const Checkout = lazy(() => import("./pages/Checkout.tsx"));
const CheckoutStatus = lazy(() => import("./pages/CheckoutStatus.tsx"));
const AccountOrders = lazy(() => import("./pages/AccountOrders.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite.tsx"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard.tsx"));
const AdminCoupons = lazy(() => import("./pages/admin/AdminCoupons.tsx"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts.tsx"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders.tsx"));
const AdminContentEditor = lazy(() => import("./pages/admin/AdminContentEditor.tsx"));
const AdminBlog = lazy(() => import("./pages/admin/AdminBlog.tsx"));
const AdminManagers = lazy(() => import("./pages/admin/AdminManagers.tsx"));
const AdminMetrics = lazy(() => import("./pages/admin/AdminMetrics.tsx"));
const AdminBling = lazy(() => import("./pages/admin/AdminBling.tsx"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings.tsx"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CartProvider>
        <SiteContentProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-label="Carregando página"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/produto/:id" element={<ProductDetail />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/calculadoras" element={<Calculators />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/aceitar-convite" element={<AcceptInvite />} />
              <Route path="/conta" element={<AccountOrders />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/checkout/sucesso" element={<CheckoutStatus type="sucesso" />} />
              <Route path="/pedido/sucesso" element={<CheckoutStatus type="sucesso" />} />
              <Route path="/checkout/falha" element={<CheckoutStatus type="falha" />} />
              <Route path="/checkout/pendente" element={<CheckoutStatus type="pendente" />} />
              <Route path="/checkout/success" element={<CheckoutStatus type="sucesso" />} />
              <Route path="/checkout/payment-error" element={<CheckoutStatus type="falha" />} />
              <Route path="/checkout/pending" element={<CheckoutStatus type="pendente" />} />
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<Dashboard />} />
                <Route path="/admin/cupons" element={<AdminCoupons />} />
                <Route path="/admin/produtos" element={<AdminProducts />} />
                <Route path="/admin/pedidos" element={<AdminOrders />} />
                <Route path="/admin/editor" element={<AdminContentEditor />} />
                <Route path="/admin/blog" element={<AdminBlog />} />
                <Route path="/admin/administradores" element={<AdminManagers />} />
                <Route path="/admin/metricas" element={<AdminMetrics />} />
                <Route path="/admin/bling" element={<AdminBling />} />
                <Route path="/admin/configuracoes" element={<AdminSettings />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
        </SiteContentProvider>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
