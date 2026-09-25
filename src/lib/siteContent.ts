export const getSectionText = (
  section: { title?: string | null; subtitle?: string | null; description?: string | null; cta_label?: string | null; cta_link?: string | null } | null,
  fallback: { title?: string; subtitle?: string; description?: string; cta_label?: string; cta_link?: string }
) => ({
  title: section?.title || fallback.title || "",
  subtitle: section?.subtitle || fallback.subtitle || "",
  description: section?.description || fallback.description || "",
  cta_label: section?.cta_label || fallback.cta_label || "",
  cta_link: section?.cta_link || fallback.cta_link || "",
});

export const getSectionItems = <T,>(section: { items?: T[] | null } | null, fallback: T[]) => {
  const items = Array.isArray(section?.items) ? section?.items : [];
  return items && items.length > 0 ? items : fallback;
};

/** Limits links edited in the CMS to protocols that are safe for storefront visitors. */
export const getSafeContentHref = (value: string | null | undefined, fallback = "#") => {
  const href = value?.trim();
  if (!href) return fallback;
  if (href.startsWith("#") || href.startsWith("/")) return href;

  try {
    const url = new URL(href);
    return ["https:", "http:", "mailto:", "tel:"].includes(url.protocol) ? href : fallback;
  } catch {
    return fallback;
  }
};

export const getSafeInternalPath = (value: string | null | undefined, fallback = "/#produtos") => {
  const href = getSafeContentHref(value, fallback);
  return href.startsWith("/") || href.startsWith("#") ? href : fallback;
};
