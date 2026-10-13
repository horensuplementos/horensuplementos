import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import {
  applyPageMetadata, getCanonicalUrl, getProductMetadata, getRouteMetadata,
  getStructuredData, serializeStructuredData, SITE_DESCRIPTION, SITE_IMAGE, SITE_TITLE, SITE_URL,
} from "./seo";

const initialHtml = readFileSync("index.html", "utf8");

describe("Metadados da Horen", () => {
  beforeEach(() => {
    document.head.innerHTML = new DOMParser().parseFromString(initialHtml, "text/html").head.innerHTML;
  });

  it("entrega metadados e dados estruturados corretos mesmo sem executar JavaScript", () => {
    const initialPage = new DOMParser().parseFromString(initialHtml, "text/html");
    expect(initialPage.documentElement.lang).toBe("pt-BR");
    expect(initialPage.title).toBe(SITE_TITLE);
    expect(initialPage.querySelectorAll("h1")).toHaveLength(1);
    expect(initialPage.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(SITE_DESCRIPTION);
    expect(SITE_DESCRIPTION.length).toBeGreaterThanOrEqual(120);
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(initialPage.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe(SITE_IMAGE);
    expect(JSON.parse(initialPage.querySelector('script[type="application/ld+json"]')!.textContent!))
      .toEqual(getStructuredData(getRouteMetadata("/")));
  });

  it("mantém canonical e OG coerentes ao abrir um produto e voltar à home", () => {
    const product = {
      id: "5f3993e6-b590-4f1c-a229-92f7c709a211", name: "Creatina Horen", price: 99.9, stock: 3,
      brand: "Horen Suplementos", image_urls: ["https://example.com/creatina.jpg"],
    };
    applyPageMetadata(getProductMetadata(product));
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href"))
      .toBe(`${SITE_URL}produto/${product.id}`);
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute("content"))
      .toBe(`${SITE_URL}produto/${product.id}`);
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe(SITE_IMAGE);
    const graph = JSON.parse(document.querySelector("#site-structured-data")!.textContent!)["@graph"];
    expect(graph.find((item: { "@type": string }) => item["@type"] === "Product").offers)
      .toMatchObject({ price: "99.90", priceCurrency: "BRL", availability: "https://schema.org/InStock" });
    applyPageMetadata(getRouteMetadata("/"));
    expect(document.title).toBe(SITE_TITLE);
    expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.querySelectorAll('meta[property="og:image"]')).toHaveLength(1);
    expect(document.querySelectorAll("#site-structured-data")).toHaveLength(1);
    expect(document.querySelector("#site-structured-data")!.textContent).not.toContain('"@type":"Product"');
  });

  it("exclui parâmetros da canonical e impede indexação de páginas privadas", () => {
    expect(getCanonicalUrl("/blog/?utm_source=whatsapp#artigo")).toBe(`${SITE_URL}blog`);
    expect(getCanonicalUrl("//external.example")).toBe(SITE_URL);
    applyPageMetadata(getRouteMetadata("/admin/produtos"));
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, follow");
    applyPageMetadata(getRouteMetadata("/blog"));
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("index, follow");
  });

  it("preserva texto do cadastro sem permitir fechamento de script no JSON-LD", () => {
    const data = { name: '</script><script>alert("x")</script>' };
    const serialized = serializeStructuredData(data);
    expect(serialized).not.toContain("</script>");
    expect(JSON.parse(serialized)).toEqual(data);
  });
});
