import { describe, expect, it } from "vitest";
import { ESSENTIAL_CONTROLS, evaluateReadiness, type ControlStatus } from "./readiness";

const all = (status: ControlStatus): Record<string, ControlStatus> =>
  Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`C${String(i + 1).padStart(2, "0")}`, status]));

describe("evaluateReadiness", () => {
  it("is 'pronta' only when every essential control is met AND has evidence", () => {
    const r = evaluateReadiness(all("atende"), [...ESSENTIAL_CONTROLS]);
    expect(r.level).toBe("pronta");
    expect(r.pending).toEqual([]);
    expect(r.essentialsMet).toBe(ESSENTIAL_CONTROLS.length);
    expect(r.essentialsWithEvidence).toBe(ESSENTIAL_CONTROLS.length);
  });

  it("is 'quase' when everything is met but some proof is missing, and lists what to send", () => {
    const r = evaluateReadiness(all("atende"), ["C03", "C06"]);
    expect(r.level).toBe("quase");
    expect(r.pending.every((p) => p.reason === "sem_evidencia")).toBe(true);
    expect(r.pending.map((p) => p.control)).toEqual(ESSENTIAL_CONTROLS.filter((c) => c !== "C03" && c !== "C06"));
  });

  it("is 'nao_pronta' when an essential control has a gap, whatever the evidence", () => {
    const controls = { ...all("atende"), C03: "nao_atende" as ControlStatus };
    const r = evaluateReadiness(controls, [...ESSENTIAL_CONTROLS]);
    expect(r.level).toBe("nao_pronta");
    expect(r.pending[0]).toEqual({ control: "C03", reason: "lacuna" });
  });

  it("treats 'parcial' as not yet met, and 'sem_dado' as unknown (not a gap)", () => {
    const r = evaluateReadiness({ ...all("atende"), C06: "parcial", C07: "sem_dado" }, [...ESSENTIAL_CONTROLS]);
    expect(r.pending.find((p) => p.control === "C06")?.reason).toBe("parcial");
    expect(r.pending.find((p) => p.control === "C07")?.reason).toBe("sem_dado");
    expect(r.level).toBe("quase");
  });

  it("is 'nao_pronta' when there is no diagnostic yet", () => {
    const r = evaluateReadiness({}, []);
    expect(r.level).toBe("sem_diagnostico");
    expect(r.essentialsMet).toBe(0);
  });

  it("is 'nao_pronta' with fewer than 4 essentials met even if none is a hard gap", () => {
    const controls = { ...all("sem_dado"), C03: "atende" as ControlStatus, C04: "atende" as ControlStatus };
    expect(evaluateReadiness(controls, []).level).toBe("nao_pronta");
  });

  it("ignores evidence on controls that are not essential", () => {
    const r = evaluateReadiness(all("atende"), ["C01", "C02"]);
    expect(r.essentialsWithEvidence).toBe(0);
    expect(r.level).toBe("quase");
  });
});
