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

import { companyProfileSchema } from "./organization";

describe("companyProfileSchema", () => {
  const base = { name: "Empresa Exemplo Ltda", cnpj: "11.222.333/0001-81", sector: "servicos", employeesRange: "11-50" };

  it("accepts a full profile and keeps only the CNPJ digits", () => {
    const r = companyProfileSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.cnpj).toBe("11222333000181");
  });

  it("treats CNPJ, sector and size as optional", () => {
    const r = companyProfileSchema.safeParse({ name: "Empresa Exemplo", cnpj: "", sector: "", employeesRange: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ name: "Empresa Exemplo", cnpj: "", sector: "", employeesRange: "" });
  });

  it("rejects bad input", () => {
    for (const patch of [{ name: "A" }, { name: "x".repeat(161) }, { cnpj: "11.222.333/0001-80" }, { sector: "cassino" }, { employeesRange: "9999" }]) {
      expect(companyProfileSchema.safeParse({ ...base, ...patch }).success, JSON.stringify(patch)).toBe(false);
    }
  });
});
