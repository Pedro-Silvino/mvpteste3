import { describe, expect, it } from "vitest";
import { normalizeDomain, organizationSchema } from "./organization";

const valid = { domain: "https://www.Exemplo.com.br/contato", acceptTerms: "on" };

describe("normalizeDomain", () => {
  it("matches the database normalization", () => {
    expect(normalizeDomain("https://www.Exemplo.com.br/contato")).toBe("exemplo.com.br");
    expect(normalizeDomain("exemplo.com.br:8080")).toBe("exemplo.com.br");
    expect(normalizeDomain("  WWW.exemplo.com?x=1 ")).toBe("exemplo.com");
  });
});

describe("organizationSchema", () => {
  it("accepts domain + terms and normalizes the domain", () => {
    const r = organizationSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.domain).toBe("exemplo.com.br");
  });

  it("requires accepting the terms", () => {
    const r = organizationSchema.safeParse({ ...valid, acceptTerms: undefined });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues[0].path).toEqual(["acceptTerms"]);
  });

  it("rejects invalid domains", () => {
    for (const domain of ["nao-e-dominio", ""]) {
      expect(organizationSchema.safeParse({ ...valid, domain }).success, domain).toBe(false);
    }
  });
});
