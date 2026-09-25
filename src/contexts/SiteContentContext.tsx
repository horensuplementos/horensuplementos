import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type SiteSection = {
  id: string;
  section_key: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  cta_label: string | null;
  cta_link: string | null;
  image_url: string | null;
  items: any[];
  active: boolean;
};

type SiteContentContextValue = {
  sections: Record<string, SiteSection>;
  loading: boolean;
  refreshSections: () => Promise<void>;
};

const SiteContentContext = createContext<SiteContentContextValue | undefined>(undefined);

const SITE_CONTENT_CACHE_KEY = "horen.site-content.v1";

const readCachedSections = (): Record<string, SiteSection> => {
  try {
    const cached = window.localStorage.getItem(SITE_CONTENT_CACHE_KEY);
    if (!cached) return {};

    const parsed = JSON.parse(cached);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const SiteContentProvider = ({ children }: { children: React.ReactNode }) => {
  const [sections, setSections] = useState<Record<string, SiteSection>>(readCachedSections);
  const [loading, setLoading] = useState(true);

  const refreshSections = async () => {
    setLoading(true);
    const db = supabase as any;
    try {
      const { data, error } = await db
        .from("site_content_sections")
        .select("*")
        .eq("active", true)
        .order("section_key");

      if (error) throw error;

      const nextSections = ((data || []) as SiteSection[]).reduce<Record<string, SiteSection>>((acc, section) => {
        acc[section.section_key] = {
          ...section,
          items: Array.isArray(section.items) ? section.items : [],
        };
        return acc;
      }, {});

      setSections(nextSections);
      window.localStorage.setItem(SITE_CONTENT_CACHE_KEY, JSON.stringify(nextSections));
    } catch (error) {
      console.error("Failed to load site content:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSections();
  }, []);

  const value = useMemo(
    () => ({ sections, loading, refreshSections }),
    [sections, loading]
  );

  return <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>;
};

export const useSiteContent = () => {
  const context = useContext(SiteContentContext);
  if (!context) throw new Error("useSiteContent must be used within SiteContentProvider");
  return context;
};

export const useSiteSection = (sectionKey: string) => {
  const { sections, loading, refreshSections } = useSiteContent();
  return {
    section: sections[sectionKey] || null,
    loading,
    refreshSections,
  };
};
