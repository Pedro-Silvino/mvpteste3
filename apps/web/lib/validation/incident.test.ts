import { describe, expect, it } from "vitest";
import { FIRST_STEPS, incidentSchema, incidentErrorMessage } from "./incident";

describe("incidentSchema", () => {
  it("accepts a short description and trims it", () => {
    const r = incidentSchema.safeParse({ description: "  Tela de resgate no financeiro  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.description).toBe("Tela de resgate no financeiro");
  });

  it("rejects too short and too long text (same limits as the table)", () => {
    expect(incidentSchema.safeParse({ description: "oi" }).success).toBe(false);
    expect(incidentSchema.safeParse({ description: "   a   " }).success).toBe(false);
    expect(incidentSchema.safeParse({ description: "x".repeat(2001) }).success).toBe(false);
    expect(incidentSchema.safeParse({ description: "x".repeat(2000) }).success).toBe(true);
  });
});

describe("FIRST_STEPS", () => {
  it("never promises an outcome (legal text rules)", () => {
    const text = FIRST_STEPS.join(" ").toLowerCase();
    for (const banned of ["garante", "100%", "risco zero", "blindagem", "indenização"]) expect(text).not.toContain(banned);
  });
});

describe("incidentErrorMessage", () => {
  it("explains the hourly limit and keeps every other error generic", () => {
    expect(incidentErrorMessage("rate_limited")).toMatch(/3 chamados/);
    expect(incidentErrorMessage("forbidden")).toBe("Não conseguimos abrir o chamado agora. Tente de novo em instantes.");
    expect(incidentErrorMessage(undefined)).toBe("Não conseguimos abrir o chamado agora. Tente de novo em instantes.");
  });
});
