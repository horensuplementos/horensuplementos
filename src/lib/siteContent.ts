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