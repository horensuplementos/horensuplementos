import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { applyPageMetadata, getRouteMetadata } from "@/lib/seo";

const SiteSeo = () => {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    applyPageMetadata(getRouteMetadata(pathname));
  }, [pathname]);
  return null;
};

export default SiteSeo;
