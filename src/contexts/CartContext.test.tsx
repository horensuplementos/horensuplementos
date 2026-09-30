import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartProvider, useCart } from "./CartContext";

const mocks = vi.hoisted(() => ({
  products: [{
    id: "5f3993e6-b590-4f1c-a229-92f7c709a211", name: "Creatina Horen", price: 89.9,
    stock: 2, image_url: "first.jpg", image_urls: ["first.jpg"], weight: "300 g", category: "Creatina", active: true,
  }],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const query = { select: () => query, in: () => query, eq: async () => ({ data: mocks.products, error: null }) };
      return query;
    },
    auth: { getSession: async () => ({ data: { session: null } }) },
    rpc: async () => ({ data: null, error: null }),
  },
}));

let cart: ReturnType<typeof useCart>;
const Consumer = () => {
  cart = useCart();
  return <p>{cart.items[0] ? `${cart.items[0].quantity} × ${cart.items[0].product.price}` : "Vazio"}</p>;
};

describe("CartProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("horen_cart_session_key", "5f3993e6-b590-4f1c-a229-92f7c709a211");
    localStorage.setItem("horen_cart_items", JSON.stringify([{ product: {
      id: mocks.products[0].id, name: "Creatina antiga", price: 99.9, stock: 5,
    }, quantity: 4 }]));
  });

  it("atualiza preço e estoque com o catálogo antes do checkout", async () => {
    render(<CartProvider><Consumer /></CartProvider>);
    expect(screen.getByText("4 × 99.9")).toBeInTheDocument();
    let result: string | undefined;
    await act(async () => { result = await cart.refreshCart(); });
    expect(result).toBe("changed");
    expect(screen.getByText("2 × 89.9")).toBeInTheDocument();
    await act(async () => { result = await cart.refreshCart(); });
    expect(result).toBe("unchanged");
  });
});
