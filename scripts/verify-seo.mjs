import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);
const html = await readFile(new URL("index.html", dist), "utf8");
const { document } = new JSDOM(html).window;
const siteUrl = "https://horensuplementos.com.br/";
const getMeta = (attribute, key) => {
  const elements = document.querySelectorAll(`meta[${attribute}="${key}"]`);
  assert.equal(elements.length, 1, `Esperada uma única meta ${key}`);
  return elements[0].content;
};

assert.equal(document.documentElement.lang, "pt-BR");
assert.equal(document.querySelectorAll("h1").length, 1);
assert.match(document.querySelector("h1").textContent, /Horen Suplementos/);
assert.equal(document.querySelectorAll('link[rel="canonical"]').length, 1);
assert.equal(document.querySelector('link[rel="canonical"]').href, siteUrl);
for (const [attribute, key] of [["name", "description"], ["property", "og:description"], ["name", "twitter:description"]]) {
  const description = getMeta(attribute, key);
  assert.ok(description.length >= 120 && description.length <= 160, `${key} deve ter entre 120 e 160 caracteres`);
}
for (const [key, expected] of Object.entries({
  "og:url": siteUrl, "og:site_name": "Horen Suplementos", "og:locale": "pt_BR",
  "og:image": `${siteUrl}og_image.png`, "og:image:width": "1200", "og:image:height": "630",
  "og:image:type": "image/png",
})) assert.equal(getMeta("property", key), expected);
assert.ok(getMeta("property", "og:image:alt"));
assert.equal(getMeta("name", "twitter:image"), `${siteUrl}og_image.png`);
assert.ok(getMeta("name", "twitter:image:alt"));
assert.equal(getMeta("name", "theme-color"), "#0c1a2c");
assert.ok(!html.includes("@Lovable") && !html.includes("id-preview-"));

const structuredData = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
assert.equal(structuredData["@context"], "https://schema.org");
for (const type of ["Organization", "WebSite", "WebPage"]) {
  assert.ok(structuredData["@graph"].some((item) => item["@type"] === type));
}

const checkPng = async (path, width, height) => {
  const png = await readFile(new URL(path, dist));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), width, `${path}: largura incorreta`);
  assert.equal(png.readUInt32BE(20), height, `${path}: altura incorreta`);
  return png;
};
const og = await checkPng("og_image.png", 1200, 630);
assert.ok(og.equals(await readFile(new URL("src/assets/og_image.png", root))), "A imagem OG deve preservar o arquivo original");
await checkPng("favicon-32x32.png", 32, 32);
await checkPng("apple-touch-icon.png", 180, 180);
for (const selector of ['link[rel="apple-touch-icon"]', 'link[rel="icon"][type="image/png"]', 'link[rel="icon"][type="image/svg+xml"]', 'link[rel="manifest"]']) {
  assert.ok(document.querySelector(selector), `Link ausente: ${selector}`);
}
await readFile(new URL("favicon.svg", dist));
const manifest = JSON.parse(await readFile(new URL("site.webmanifest", dist), "utf8"));
assert.equal(manifest.name, "Horen Suplementos");
assert.equal(manifest.start_url, "/");
for (const icon of manifest.icons) {
  const [width, height] = icon.sizes.split("x").map(Number);
  await checkPng(icon.src.slice(1), width, height);
}
console.log("SEO do build validado: metadados, H1, JSON-LD, imagem OG original, ícones e manifest.");
