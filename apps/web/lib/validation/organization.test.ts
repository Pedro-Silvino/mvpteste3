import { describe, expect, it } from "vitest";
import { normalizeDomain, organizationSchema } from "./organization";

const valid = {
  name: "Empresa Exemplo",
  cnpj: "11.222.333/0001-81",
  domain: "https://www.Exemplo.com.br/contato",
  sector: "servicos",
  employeesRange: "11-50",
  acceptTerms: "on",
};

describe("normalizeDomain", () => {
  it("matches the database normalization", () => {
    expect(normalizeDomain("https://www.Exemplo.com.br/contato")).toBe("exemplo.com.br");
    expect(normalizeDomain("exemplo.com.br:8080")).toBe("exemplo.com.br");
    expect(normalizeDomain("  WWW.exemplo.com?x=1 ")).toBe("exemplo.com");
  });
});

describe("organizationSchema", () => {
  it("accepts a valid form and normalizes fields", () => {
    const r = organizationSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.cnpj).toBe("11222333000181");
    expect(r.data.domain).toBe("exemplo.com.br");
    expect(r.data.name).toBe("Empresa Exemplo");
  });

  it("requires accepting the terms", () => {
    const r = organizationSchema.safeParse({ ...valid, acceptTerms: undefined });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues[0].path).toEqual(["acceptTerms"]);
  });

  it("rejects invalid CNPJ, domain, sector and employee range", () => {
    for (const patch of [
      { cnpj: "11.222.333/0001-80" },
      { domain: "nao-e-dominio" },
      { domain: "" },
      { sector: "cassino" },
      { employeesRange: "9999" },
      { name: "A" },
      { name: "x".repeat(161) },
    ]) {
      expect(organizationSchema.safeParse({ ...valid, ...patch }).success, JSON.stringify(patch)).toBe(false);
    }
  });
});
