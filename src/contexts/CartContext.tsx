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
  addItem: (product: CartProduct) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  totalItems: number;
  totalPrice: number;
  sessionKey: string;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem("horen_cart_items");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [sessionKey, setSessionKey] = useState(() => {
    const storageKey = "horen_cart_session_key";
    const existing = localStorage.getItem(storageKey);
    if (existing) return existing;
    const next = crypto.randomUUID();
    localStorage.setItem(storageKey, next);
    return next;
  });
  const [isOpen, setIsOpen] = useState(false);

  const addItem = useCallback((product: CartProduct) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
          return prev.map((item) =>
            item.product.id === product.id
            ? { ...item, quantity: product.stock != null ? Math.min(item.quantity + 1, product.stock) : item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
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
          ? { ...item, quantity: item.product.stock != null ? Math.min(quantity, item.product.stock) : quantity }
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
        clearCart, toggleCart, openCart, closeCart, totalItems, totalPrice, sessionKey,
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
