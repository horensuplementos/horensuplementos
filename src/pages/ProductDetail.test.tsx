import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProductDetail from "./ProductDetail";

const mocks = vi.hoisted(() => ({
  addItem: vi.fn(),
  from: vi.fn(),
  items: [] as { product: { id: string }; quantity: number }[],
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/contexts/CartContext", () => ({ useCart: () => ({ addItem: mocks.addItem, items: mocks.items }) }));
vi.mock("@/components/Header", () => ({ default: () => <header /> }));
vi.mock("@/components/CartDrawer", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => <footer /> }));

const product = {
  id: "5f3993e6-b590-4f1c-a229-92f7c709a211",
  active: true,
  name: "Creatina Horen",
  category: "Creatina",
  brand: "Horen Suplementos",
  flavor: "Sem sabor",
  weight: "300 g",
  price: 99.9,
  stock: 3,
  description: "Descrição detalhada.",
  ai_description_short: "Força para a rotina.",
  ai_description_long: null,
  ai_benefits: ["Benefício revisado"],
  benefits_input: null,
  ingredients: "Creatina monohidratada",
  ai_faq: [{ q: "Como usar?", a: "Conforme o rótulo." }],
  image_url: "https://example.com/first.jpg",
  image_urls: ["https://example.com/first.jpg", "https://example.com/second.jpg"],
};

const renderPage = () => render(<MemoryRouter initialEntries={[`/produto/${product.id}`]}>
  <Routes><Route path="/produto/:id" element={<ProductDetail />} /></Routes>
</MemoryRouter>);

describe("ProductDetail", () => {
  beforeEach(() => {
    mocks.addItem.mockReset();
    mocks.from.mockReset();
    mocks.items = [];
    mocks.from.mockImplementation(() => {
      const query = {
        select: () => query,
        eq: () => query,
        neq: () => query,
        maybeSingle: async () => ({ data: product, error: null }),
        limit: async () => ({ data: [], error: null }),
      };
      return query;
    });
  });

  it("mostra o conteúdo cadastrado, alterna imagens e adiciona a quantidade escolhida", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: product.name, level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Benefício revisado")).toBeInTheDocument();
    expect(screen.getByText(product.ingredients)).toBeInTheDocument();
    expect(screen.getByText("Como usar?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Próxima imagem" }));
    expect(screen.getByRole("img", { name: /imagem 2 de 2/ })).toHaveAttribute("src", product.image_urls[1]);
    fireEvent.click(screen.getByRole("button", { name: "Aumentar quantidade" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ao carrinho" }));
    expect(mocks.addItem).toHaveBeenCalledWith(expect.objectContaining({ id: product.id, image_url: product.image_urls[0] }), 2);
  });

  it("não oferece mais unidades quando todo o estoque já está no carrinho", async () => {
    mocks.items = [{ product: { id: product.id }, quantity: 3 }];
    renderPage();
    expect(await screen.findByText("Todas as unidades disponíveis já estão no carrinho")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar ao carrinho" })).not.toBeInTheDocument();
  });

  it("mostra ausência de produto sem travar o carregamento", async () => {
    mocks.from.mockImplementation(() => {
      const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: null, error: null }) };
      return query;
    });
    renderPage();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Produto não encontrado" })).toBeInTheDocument());
  });
});
