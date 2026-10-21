import { describe, expect, it } from "vitest";
import base12 from "./base12.json";
import { opportunities, threatExposure } from "./threats";

const ALL = Array.from({ length: 12 }, (_, i) => `C${String(i + 1).padStart(2, "0")}`);
const rows = (answers: Record<string, string>) => ALL.map((id) => ({ control_id: id, status: answers[id] ?? "sem_dado" }));
const all = (status: string) => rows(Object.fromEntries(ALL.map((c) => [c, status])));
const level = (r: ReturnType<typeof rows>, ext?: Record<string, string> | null) =>
  Object.fromEntries(threatExposure(r, ext).map((t) => [t.id, t.level]));
const EXT_FAIL = { X01: "falha", X02: "falha", X03: "falha", X04: "falha", X05: "falha", X06: "falha" };
const EXT_OK = { X01: "ok", X02: "ok", X03: "ok", X04: "ok", X05: "ok", X06: "ok" };

describe("threatExposure (same cases as worker/tests/test_scoring.py)", () => {
  it("every control and external check belongs to some threat", () => {
    expect(new Set(base12.ameacas.flatMap((t) => t.controles))).toEqual(new Set(ALL));
    expect(new Set(base12.ameacas.flatMap((t) => t.checagens))).toEqual(new Set(base12.checagens_externas.map((c) => c.id)));
  });

  it("all no is high everywhere; all yes is low", () => {
    expect(new Set(Object.values(level(all("nao_atende"), EXT_FAIL)))).toEqual(new Set(["Alto"]));
    expect(new Set(Object.values(level(all("atende"), EXT_OK)))).toEqual(new Set(["Baixo"]));
  });

  it("follows the thresholds", () => {
    const yes = Object.fromEntries(ALL.map((c) => [c, "atende"]));
    expect(level(rows({ ...yes, C06: "nao_atende" })).ransomware).toBe("Médio"); // 6/9 = 67
    expect(level(rows({ ...yes, C06: "nao_atende", C07: "nao_atende", C04: "nao_atende" })).ransomware).toBe("Alto"); // 2/9 = 22
  });

  it("'não sei' counts as zero for controls", () => {
    expect(level(all("sem_dado")).ransomware).toBe("Alto");
  });

  it("external-only threat uses the scan and ignores no data", () => {
    const yes = all("atende");
    expect(level(yes, { X01: "falha", X02: "falha", X03: "sem_dado" }).falsificacao_dominio).toBe("Alto");
    expect(level(yes, { X01: "ok", X02: "parcial", X03: "sem_dado" }).falsificacao_dominio).toBe("Médio");
    expect(level(yes, null).falsificacao_dominio).toBe("Sem dado");
    expect(level(yes, { X01: "sem_dado", X02: "sem_dado", X03: "sem_dado" }).falsificacao_dominio).toBe("Sem dado");
  });

  it("sorts the most exposed first and carries the texts", () => {
    const yes = Object.fromEntries(ALL.map((c) => [c, "atende"]));
    const out = threatExposure(rows({ ...yes, C03: "nao_atende", C09: "nao_atende", C11: "nao_atende" }), null);
    expect(out[0].id).toBe("fraude_email");
    expect(out[0].level).toBe("Alto");
    expect(out.every((t) => t.how && t.loss)).toBe(true);
    expect(opportunities()).toHaveLength(4);
  });

  it("never carries a control name or fix step (they are paid content)", () => {
    for (const t of threatExposure(all("nao_atende"), EXT_FAIL)) expect(Object.keys(t)).toEqual(["id", "name", "level", "how", "loss"]);
  });
});
