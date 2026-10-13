export const SITE_URL = "https://horensuplementos.com.br/";
export const SITE_NAME = "Horen Suplementos";
export const SITE_TITLE = "Horen Suplementos | Suplementação de alta performance";
export const SITE_DESCRIPTION = "Conheça a Horen Suplementos: creatina e suplementação de alta performance para complementar sua rotina de treino. Explore nossa linha de produtos.";
export const SITE_IMAGE = `${SITE_URL}og_image.png`;
export const SITE_IMAGE_ALT = "Logotipo Horen em tom creme sobre fundo azul-escuro.";

export interface ProductSeoData {
  id: string;
  name: string;
  price: number;
  stock: number;
  description?: string | null;
  ai_meta_description?: string | null;
  ai_description_short?: string | null;
  brand?: string | null;
  category?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
}

export interface PageMetadata {
  pathname: string;
  title: string;
  description: string;
  noIndex?: boolean;
  product?: ProductSeoData;
}

export const getCanonicalUrl = (pathname: string) => {
  const path = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return SITE_URL;
  return new URL(path, SITE_URL).href;
};

export const getRouteMetadata = (pathname: string): PageMetadata => {
  const publicPages: Record<string, { title: string; description: string }> = {
    "/": { title: SITE_TITLE, description: SITE_DESCRIPTION },
    "/blog": {
      title: `Blog sobre suplementação e performance | ${SITE_NAME}`,
      description: "Explore o blog da Horen Suplementos: conteúdos sobre creatina, suplementação e rotina de treino para conhecer os produtos e fazer escolhas informadas.",
    },
    "/calculadoras": {
      title: `Calculadoras de creatina e metabolismo | ${SITE_NAME}`,
      description: "Use as calculadoras da Horen para estimar a duração da sua creatina e a taxa metabólica basal. Consulte os resultados e organize sua rotina de treino.",
    },
  };
  const path = new URL(getCanonicalUrl(pathname)).pathname;
  if (publicPages[path]) return { pathname: path, ...publicPages[path] };
  if (path.startsWith("/produto/")) return {
    pathname: path, title: `Produto | ${SITE_NAME}`, description: SITE_DESCRIPTION,
  };
  return { pathname: path, title: SITE_NAME, description: SITE_DESCRIPTION, noIndex: true };
};

export const getProductMetadata = (product: ProductSeoData): PageMetadata => ({
  pathname: `/produto/${product.id}`,
  title: `${product.name} | ${SITE_NAME}`,
  description: product.ai_meta_description?.trim() || product.ai_description_short?.trim() ||
    product.description?.trim().slice(0, 160) || SITE_DESCRIPTION,
  product,
});

export const getStructuredData = (metadata: PageMetadata) => {
  const url = getCanonicalUrl(metadata.pathname);
  const organizationId = `${SITE_URL}#organization`;
  const websiteId = `${SITE_URL}#website`;
  const graph: Record<string, unknown>[] = [
    {
      "@type": "Organization", "@id": organizationId, name: SITE_NAME, url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}horen-logo.png`, width: 417, height: 68 },
    },
    {
      "@type": "WebSite", "@id": websiteId, name: SITE_NAME, url: SITE_URL,
      inLanguage: "pt-BR", publisher: { "@id": organizationId },
    },
    {
      "@type": "WebPage", "@id": `${url}#webpage`, name: metadata.title,
      description: metadata.description, url, inLanguage: "pt-BR",
      isPartOf: { "@id": websiteId },
      primaryImageOfPage: { "@type": "ImageObject", url: SITE_IMAGE, width: 1200, height: 630 },
      ...(metadata.product ? { mainEntity: { "@id": `${url}#product` } } : {}),
    },
  ];
  if (metadata.product) {
    const product = metadata.product;
    const images = (product.image_urls?.length ? product.image_urls : [product.image_url])
      .filter((image): image is string => typeof image === "string" && !!image.trim());
    graph.push({
      "@type": "Product", "@id": `${url}#product`, name: product.name,
      description: metadata.description, url,
      ...(images.length ? { image: images } : {}),
      ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
      ...(product.category ? { category: product.category } : {}),
      ...(Number.isFinite(product.price) && product.price >= 0 ? {
        offers: {
          "@type": "Offer", url, priceCurrency: "BRL", price: product.price.toFixed(2),
          availability: `https://schema.org/${product.stock > 0 ? "InStock" : "OutOfStock"}`,
          seller: { "@id": organizationId },
        },
      } : {}),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
};

export const serializeStructuredData = (data: unknown) => JSON.stringify(data)
  .replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")
  .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

// Keep one copy of each tag. The initial HTML is complete for scanners that
// read the SPA shell; route updates are also visible to Lovable's prerenderer.
export const applyPageMetadata = (metadata: PageMetadata) => {
  const upsertMeta = (attribute: "name" | "property", key: string, value: string) => {
    const matches = [...document.head.querySelectorAll<HTMLMetaElement>(`meta[${attribute}="${key}"]`)];
    const element = matches.shift() || document.createElement("meta");
    matches.forEach((duplicate) => duplicate.remove());
    element.setAttribute(attribute, key);
    element.content = value;
    if (!element.isConnected) document.head.append(element);
  };
  document.title = metadata.title;
  const url = getCanonicalUrl(metadata.pathname);
  upsertMeta("name", "description", metadata.description);
  upsertMeta("name", "robots", metadata.noIndex ? "noindex, follow" : "index, follow");
  for (const [key, value] of Object.entries({
    "og:title": metadata.title, "og:description": metadata.description, "og:url": url,
    "og:type": "website", "og:site_name": SITE_NAME, "og:locale": "pt_BR",
    "og:image": SITE_IMAGE, "og:image:secure_url": SITE_IMAGE, "og:image:type": "image/png",
    "og:image:width": "1200", "og:image:height": "630", "og:image:alt": SITE_IMAGE_ALT,
  })) upsertMeta("property", key, value);
  for (const [key, value] of Object.entries({
    "twitter:card": "summary_large_image", "twitter:title": metadata.title,
    "twitter:description": metadata.description, "twitter:image": SITE_IMAGE,
    "twitter:image:alt": SITE_IMAGE_ALT,
  })) upsertMeta("name", key, value);

  const canonicals = [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]')];
  const canonical = canonicals.shift() || document.createElement("link");
  canonicals.forEach((duplicate) => duplicate.remove());
  canonical.rel = "canonical";
  canonical.href = url;
  if (!canonical.isConnected) document.head.append(canonical);

  const scripts = [...document.head.querySelectorAll<HTMLScriptElement>('script[id="site-structured-data"]')];
  const script = scripts.shift() || document.createElement("script");
  scripts.forEach((duplicate) => duplicate.remove());
  script.id = "site-structured-data";
  script.type = "application/ld+json";
  script.textContent = serializeStructuredData(getStructuredData(metadata));
  if (!script.isConnected) document.head.append(script);
};
