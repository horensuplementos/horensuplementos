import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const baseUrl = process.env.SEO_PREVIEW_URL || "http://127.0.0.1:4177";
const siteUrl = "https://horensuplementos.com.br/";
const product = {
  id: "5f3993e6-b590-4f1c-a229-92f7c709a211", name: "Creatina Horen", active: true,
  price: 99.9, stock: 3, weight: "300 g", category: "Creatina", brand: "Horen",
  description: "Produto de teste local para verificar os metadados.",
  image_url: null, image_urls: [], ai_benefits: [], ai_faq: [],
};

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  // Isolate browser checks from the Live backend, including cart RPC writes.
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(baseUrl).origin) return route.continue();
    if (url.pathname.endsWith("/products")) {
      const data = url.searchParams.has("id") && url.searchParams.get("id").startsWith("neq.") ? [] : [product];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto(baseUrl);
  await page.waitForSelector("header");
  assert.equal(await page.locator("h1").count(), 1);
  const homeMetadata = await page.evaluate(() => ({
    canonical: document.querySelector('link[rel="canonical"]').href,
    ogUrl: document.querySelector('meta[property="og:url"]').content,
    image: document.querySelector('meta[property="og:image"]').content,
    language: document.documentElement.lang,
  }));
  assert.deepEqual(homeMetadata, { canonical: siteUrl, ogUrl: siteUrl, image: `${siteUrl}og_image.png`, language: "pt-BR" });
  for (const asset of ["og_image.png", "favicon.ico", "favicon-32x32.png", "favicon.svg", "apple-touch-icon.png", "site.webmanifest", "icons/icon-192x192.png", "icons/icon-512x512.png"]) {
    const response = await page.request.get(`${baseUrl}/${asset}`);
    assert.equal(response.status(), 200, `Asset indisponível: ${asset}`);
    assert.ok(!response.headers()["content-type"].includes("text/html"), `Asset servido como HTML: ${asset}`);
  }
  await page.screenshot({ path: "/tmp/horen-seo-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Overflow horizontal na home mobile");
  await page.screenshot({ path: "/tmp/horen-seo-mobile.png", fullPage: true });

  await page.goto(`${baseUrl}/produto/${product.id}`);
  await page.getByRole("heading", { level: 1, name: product.name, exact: true }).waitFor();
  assert.equal(await page.locator("h1").count(), 1);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), `${siteUrl}produto/${product.id}`);
  const graph = JSON.parse(await page.locator("#site-structured-data").textContent())["@graph"];
  assert.ok(graph.some((item) => item["@type"] === "Product" && item.name === product.name));
  await page.locator('nav[aria-label="Navegação do produto"]').getByRole("link", { name: "Início", exact: true }).click();
  await page.waitForURL(baseUrl + "/");
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), siteUrl);
  assert.equal(await page.locator("h1").count(), 1);
  await page.goto(`${baseUrl}/blog?utm_source=test`);
  await page.waitForSelector("header");
  await page.waitForFunction(() => document.querySelector('link[rel="canonical"]').href.endsWith("/blog"));
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), `${siteUrl}blog`);
  assert.equal(await page.locator("h1").count(), 1);
  console.log("Navegador validado: H1 único, canonical por rota, JSON-LD e arquivos estáticos disponíveis, sem acesso ao Live.");
} finally {
  await browser.close();
}
