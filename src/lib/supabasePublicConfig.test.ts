import { describe, expect, it } from "vitest";
import { Buffer } from "node:buffer";
import { resolvePublicSupabaseConfig } from "../../config/supabase-public";

// All keys here are synthetic, not credentials issued by a provider.
const live = { url: "https://live-example.supabase.co", publishableKey: "sb_publishable_synthetic_live" };
const test = { url: "https://test-example.supabase.co", publishableKey: "sb_publishable_synthetic_test" };
function syntheticJwt(role: string, ref = "live-example") {
  return [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify({ role, ref })).toString("base64url"),
    "synthetic_signature_not_a_real_credential",
  ].join(".");
}

describe("Supabase public build configuration", () => {
  it("builds without .env using the committed public configuration", () => {
    expect(resolvePublicSupabaseConfig({}, live)).toEqual(live);
  });

  it("lets a complete local/Test pair override Live", () => {
    expect(resolvePublicSupabaseConfig({
      VITE_SUPABASE_URL: test.url,
      VITE_SUPABASE_PUBLISHABLE_KEY: test.publishableKey,
    }, live)).toEqual(test);
  });

  it("does not read backend credentials or other env values", () => {
    expect(resolvePublicSupabaseConfig({ SUPABASE_SERVICE_ROLE_KEY: "synthetic_private_value" }, live)).toEqual(live);
  });

  it.each([
    { VITE_SUPABASE_URL: test.url },
    { VITE_SUPABASE_PUBLISHABLE_KEY: test.publishableKey },
    { VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "" },
    { VITE_SUPABASE_URL: "   ", VITE_SUPABASE_PUBLISHABLE_KEY: test.publishableKey },
  ])("fails closed rather than combining an incomplete override with Live: %o", (env) => {
    expect(() => resolvePublicSupabaseConfig(env, live)).toThrow(/ausente/);
  });

  it.each([undefined, null, [], "not configuration", {}, { url: live.url }, { publishableKey: live.publishableKey }])(
    "rejects missing or malformed public configuration: %o", (config) => {
      expect(() => resolvePublicSupabaseConfig({}, config)).toThrow(/configuração Supabase/);
    },
  );

  it("rejects extra fields instead of accepting a backend secret in the public file", () => {
    expect(() => resolvePublicSupabaseConfig({}, { ...live, serviceRoleKey: "synthetic_private_value" })).toThrow(/campos não permitidos/);
  });

  it("accepts legacy anon JWT keys for the matching project", () => {
    const config = { ...live, publishableKey: syntheticJwt("anon") };
    expect(resolvePublicSupabaseConfig({}, config)).toEqual(config);
  });

  it.each(["service_role", "authenticated", "admin"])("rejects JWT role %s", (role) => {
    expect(() => resolvePublicSupabaseConfig({}, { ...live, publishableKey: syntheticJwt(role) })).toThrow(/proibidas/);
  });

  it.each(["sb_secret_synthetic", "malformed-key", "a.invalid-payload.c"])("rejects a private or invalid key: %s", (key) => {
    expect(() => resolvePublicSupabaseConfig({}, { ...live, publishableKey: key })).toThrow(/proibidas/);
  });

  it("rejects an anon JWT from another project", () => {
    expect(() => resolvePublicSupabaseConfig({}, { ...live, publishableKey: syntheticJwt("anon", "test-example") })).toThrow(/mesmo projeto/);
  });

  it.each([
    "invalid-url", "http://remote.example", "https://user:password@remote.example",
    "https://remote.example/rest/v1", "https://remote.example?token=synthetic", "https://remote.example#synthetic",
  ])("rejects unsafe or malformed URLs: %s", (url) => {
    expect(() => resolvePublicSupabaseConfig({}, { ...live, url })).toThrow(/VITE_SUPABASE_URL/);
  });

  it.each(["http://localhost:54321", "http://127.0.0.1:54321", "http://[::1]:54321"])("allows local Supabase: %s", (url) => {
    expect(resolvePublicSupabaseConfig({}, { ...live, url })).toEqual({ ...live, url });
  });

  it("normalizes whitespace and the optional root slash", () => {
    expect(resolvePublicSupabaseConfig({}, {
      url: ` ${live.url}/ `, publishableKey: ` ${live.publishableKey} `,
    })).toEqual(live);
  });

  it("does not expose supplied private values in errors", () => {
    const privateValue = "sb_secret_synthetic_value_that_must_not_appear";
    try {
      resolvePublicSupabaseConfig({}, { ...live, publishableKey: privateValue });
      expect.fail("Expected the build to reject a private key");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("VITE_SUPABASE_PUBLISHABLE_KEY");
      expect((error as Error).message).not.toContain(privateValue);
    }
  });
});
