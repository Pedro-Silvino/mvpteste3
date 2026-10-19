import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSteps, firstUnansweredIndex, isValidAnswer } from "./questionnaire";

describe("catalog copy", () => {
  it("apps/web/lib/base12.json is identical to docs/BASE12.json", () => {
    const local = readFileSync(resolve(__dirname, "base12.json"), "utf8");
    const source = readFileSync(resolve(__dirname, "../../../docs/BASE12.json"), "utf8");
    expect(local).toBe(source);
  });
});

describe("buildSteps", () => {
  const steps = buildSteps();

  it("has 4 registration questions followed by the 12 controls", () => {
    expect(steps).toHaveLength(16);
    expect(steps.slice(0, 4).every((s) => s.id.startsWith("Q_"))).toBe(true);
    expect(steps.slice(4).map((s) => s.id)).toEqual(
      Array.from({ length: 12 }, (_, i) => `C${String(i + 1).padStart(2, "0")}`),
    );
  });

  it("always offers 'Não sei' as the last option and uses Portuguese labels", () => {
    for (const s of steps) {
      expect(s.options.length).toBeGreaterThanOrEqual(2);
      expect(s.options.at(-1)?.value).toBe("nao_sei");
      expect(s.options.every((o) => o.label.length > 0)).toBe(true);
    }
    const c03 = steps.find((s) => s.id === "C03")!;
    expect(c03.options.map((o) => o.label)).toEqual(["Sim", "Mais ou menos", "Não", "Não sei"]);
  });
});

describe("isValidAnswer", () => {
  it("accepts only values offered by that question", () => {
    expect(isValidAnswer("C01", "sim")).toBe(true);
    expect(isValidAnswer("C01", "parcial")).toBe(false); // C01 has no 'parcial'
    expect(isValidAnswer("Q_TI", "prestador_externo")).toBe(true);
    expect(isValidAnswer("Q_TI", "sim")).toBe(false);
    expect(isValidAnswer("C99", "sim")).toBe(false);
  });
});

describe("firstUnansweredIndex", () => {
  it("resumes at the first missing answer, or the end when complete", () => {
    const steps = buildSteps();
    expect(firstUnansweredIndex(steps, {})).toBe(0);
    expect(firstUnansweredIndex(steps, { Q_INCIDENTE: "nao", Q_TI: "ninguem" })).toBe(2);
    const all = Object.fromEntries(steps.map((s) => [s.id, s.options[0].value]));
    expect(firstUnansweredIndex(steps, all)).toBe(steps.length);
  });
});
