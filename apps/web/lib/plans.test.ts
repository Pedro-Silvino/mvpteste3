import { describe, expect, it } from "vitest";
import { isPaidPlan, PAID_PLANS, PLANS, planName } from "./plans";

describe("plans", () => {
  it("has the free tier plus three paid plans, matching the database check constraint", () => {
    expect(PLANS.map((p) => p.id)).toEqual(["express", "essencial", "dossie", "360"]);
    expect(PAID_PLANS).toEqual(["essencial", "dossie", "360"]);
  });

  it("only the paid plans unlock the gaps", () => {
    expect(isPaidPlan("express")).toBe(false);
    expect(isPaidPlan(null)).toBe(false);
    expect(isPaidPlan("essencial")).toBe(true);
    expect(isPaidPlan("360")).toBe(true);
  });

  it("shows no price anywhere (D10)", () => {
    const text = JSON.stringify(PLANS);
    expect(text).not.toMatch(/R\$|\d+\s*\/\s*mês/);
  });

  it("falls back to the free name", () => {
    expect(planName("dossie")).toBe("Dossiê Prova");
    expect(planName(undefined)).toBe("Grátis");
  });
});
