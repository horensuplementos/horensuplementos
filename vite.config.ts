import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { readFileSync } from "node:fs";
import { componentTagger } from "lovable-tagger";
import { resolvePublicSupabaseConfig } from "./config/supabase-public";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  let publicConfig: unknown;
  try {
    publicConfig = JSON.parse(readFileSync(path.resolve(__dirname, "config/supabase.public.json"), "utf8"));
  } catch {
    throw new Error("[configuração Supabase] config/supabase.public.json ausente ou JSON inválido; valores omitidos.");
  }
  const supabase = resolvePublicSupabaseConfig(loadEnv(mode, __dirname, "VITE_"), publicConfig);

  return {
    // Use the same configuration for the generated client and OAuth URLs.
    // Only these two explicitly public values are injected into the browser.
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabase.url),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabase.publishableKey),
    },
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
  };
});
