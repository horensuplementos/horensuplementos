import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CartProduct {
  id: string;
  name: string;
  price: number;
  image_url?: string | null;
  weight?: string | null;
  category?: string | null;
  stock?: number | null;
}

export interface CartItem {
  product: CartProduct;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  isOpen: boolean;
  addItem: (product: CartProduct, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  refreshCart: () => Promise<"unchanged" | "changed" | "error">;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  totalItems: number;
  totalPrice: number;
  sessionKey: string;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const readStoredItems = (): CartItem[] => {
  try {
    const stored = JSON.parse(localStorage.getItem("horen_cart_items") || "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter((item) => item && item.product &&
      typeof item.product.id === "string" && typeof item.product.name === "string" &&
      Number.isFinite(item.product.price) && item.product.price >= 0 &&
      Number.isSafeInteger(item.quantity) && item.quantity > 0)
      .map((item) => ({ ...item, quantity: Math.min(item.quantity, 50) }));
  } catch { return []; }
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(readStoredItems);
  const [sessionKey, setSessionKey] = useState(() => {
    const storageKey = "horen_cart_session_key";
    const existing = localStorage.getItem(storageKey);
    if (existing) return existing;
    const next = crypto.randomUUID();
    localStorage.setItem(storageKey, next);
    return next;
  });
  const [isOpen, setIsOpen] = useState(false);

  const addItem = useCallback((product: CartProduct, quantity = 1) => {
    if (!Number.isSafeInteger(quantity) || quantity < 1 || (product.stock != null && product.stock < 1)) return;
    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
          return prev.map((item) =>
            item.product.id === product.id
            ? { product, quantity: Math.min(item.quantity + quantity, product.stock ?? 50, 50) }
            : item
        );
      }
      return [...prev, { product, quantity: Math.min(quantity, product.stock ?? 50, 50) }];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((item) => item.product.id !== productId));
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: Math.min(quantity, item.product.stock ?? 50, 50) }
          : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    const nextSessionKey = crypto.randomUUID();
    localStorage.setItem("horen_cart_session_key", nextSessionKey);
    setItems([]);
    setSessionKey(nextSessionKey);
  }, []);

  const refreshCart = useCallback(async (): Promise<"unchanged" | "changed" | "error"> => {
    if (!items.length) return "unchanged";
    const requestedIds = new Set(items.map((item) => item.product.id));
    const { data, error } = await supabase.from("products")
      .select("id, name, price, stock, image_url, image_urls, weight, category, active")
      .in("id", [...requestedIds]).eq("active", true);
    if (error) return "error";
    const catalog = new Map((data || []).map((product) => [product.id, product]));
    const reconcile = (current: CartItem[]): CartItem[] => current.flatMap((item) => {
      if (!requestedIds.has(item.product.id)) return [item];
      const product = catalog.get(item.product.id);
      if (!product || product.stock <= 0) return [];
      return [{
        product: {
          id: product.id, name: product.name, price: product.price, stock: product.stock,
          image_url: product.image_urls?.[0] || product.image_url,
          weight: product.weight, category: product.category,
        },
        quantity: Math.min(item.quantity, product.stock, 50),
      }];
    });
    const changed = JSON.stringify(reconcile(items)) !== JSON.stringify(items);
    if (changed) setItems((current) => reconcile(current));
    return changed ? "changed" : "unchanged";
  }, [items]);
  const toggleCart = useCallback(() => setIsOpen((p) => !p), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  useEffect(() => {
    localStorage.setItem("horen_cart_items", JSON.stringify(items));
    const syncCart = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const serializedItems = JSON.parse(JSON.stringify(items));
      await supabase.rpc("upsert_cart_session", {
        p_session_id: sessionKey,
        p_user_id: session?.user.id || null,
        p_email: session?.user.email || null,
        p_status: "active",
        p_items: serializedItems,
        p_items_count: items.reduce((sum, item) => sum + item.quantity, 0),
        p_cart_total: items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
        p_metadata: { source: "storefront" },
      });
    };
    void syncCart();
  }, [items, sessionKey]);

  return (
    <CartContext.Provider
      value={{
        items, isOpen, addItem, removeItem, updateQuantity,
        clearCart, refreshCart, toggleCart, openCart, closeCart, totalItems, totalPrice, sessionKey,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
