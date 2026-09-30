import { describe, expect, it } from "vitest";
import { getSafeInternalPath } from "./siteContent";

describe("getSafeInternalPath", () => {
  it("aceita destinos internos usados depois do login", () => {
    expect(getSafeInternalPath("/conta", "/")).toBe("/conta");
    expect(getSafeInternalPath("/aceitar-convite?token=abc", "/")).toBe("/aceitar-convite?token=abc");
  });

  it("rejeita destinos externos e barras invertidas", () => {
    expect(getSafeInternalPath("https://example.com", "/")).toBe("/");
    expect(getSafeInternalPath("//example.com", "/")).toBe("/");
    expect(getSafeInternalPath("/\\example.com", "/")).toBe("/");
    expect(getSafeInternalPath("/conta\n", "/")).toBe("/");
  });
});
