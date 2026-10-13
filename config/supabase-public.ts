export type PublicSupabaseConfig = {
  url: string;
  publishableKey: string;
};

type BuildEnvironment = Record<string, string | undefined>;

function invalid(message: string): never {
  // Never include supplied values: a misconfigured variable could be a secret.
  throw new Error(`[configuração Supabase] ${message}`);
}

/** Validate browser-safe configuration, not server credentials. */
export function resolvePublicSupabaseConfig(
  env: BuildEnvironment,
  publicConfig: unknown,
): PublicSupabaseConfig {
  // Overrides are an atomic pair. Never combine a Test URL with a Live key,
  // or fall back to Live when an override is empty or incomplete.
  const overridden = env.VITE_SUPABASE_URL !== undefined
    || env.VITE_SUPABASE_PUBLISHABLE_KEY !== undefined;

  let url: unknown;
  let publishableKey: unknown;
  if (overridden) {
    url = env.VITE_SUPABASE_URL;
    publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  } else {
    if (!publicConfig || typeof publicConfig !== "object" || Array.isArray(publicConfig)) {
      invalid("config/supabase.public.json deve conter apenas url e publishableKey.");
    }
    const config = publicConfig as Record<string, unknown>;
    if (Object.keys(config).some((key) => !["url", "publishableKey"].includes(key))) {
      invalid("config/supabase.public.json possui campos não permitidos; segredos de backend não pertencem ao frontend.");
    }
    url = config.url;
    publishableKey = config.publishableKey;
  }

  if (typeof url !== "string" || !url.trim()) {
    invalid("VITE_SUPABASE_URL ausente. Configure o par de variáveis locais ou config/supabase.public.json.");
  }
  if (typeof publishableKey !== "string" || !publishableKey.trim()) {
    invalid("VITE_SUPABASE_PUBLISHABLE_KEY ausente. Configure o par de variáveis locais ou config/supabase.public.json.");
  }

  let endpoint: URL;
  try {
    endpoint = new URL(url.trim());
  } catch {
    invalid("VITE_SUPABASE_URL deve ser uma URL válida.");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname);
  if ((endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && local))
    || endpoint.username || endpoint.password || endpoint.search || endpoint.hash
    || endpoint.pathname !== "/") {
    invalid("VITE_SUPABASE_URL deve usar HTTPS sem credenciais, caminhos ou parâmetros (HTTP permitido somente em localhost).");
  }

  const key = publishableKey.trim();
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    const parts = key.split(".");
    let payload: Record<string, unknown> | undefined;
    try {
      if (parts.length === 3 && parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) {
        payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
      }
    } catch {
      // Only an error naming the variable is emitted below, never the JWT.
    }
    if (!payload || payload.role !== "anon") {
      invalid("VITE_SUPABASE_PUBLISHABLE_KEY deve ser publishable ou JWT anon; chaves secret/service_role são proibidas.");
    }
    if (endpoint.hostname.endsWith(".supabase.co")
      && payload.ref !== endpoint.hostname.split(".")[0]) {
      invalid("VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY devem pertencer ao mesmo projeto Supabase.");
    }
  }

  return { url: endpoint.origin, publishableKey: key };
}
