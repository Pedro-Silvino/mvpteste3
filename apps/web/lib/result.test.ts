import { describe, expect, it } from "vitest";
import { bandFor, countByStatus, topRisks } from "./result";

describe("bandFor", () => {
  it("maps score to the catalog bands", () => {
    expect(bandFor(0).label).toBe("Exposta");
    expect(bandFor(39).label).toBe("Exposta");
    expect(bandFor(40).label).toBe("Em construção");
    expect(bandFor(70).label).toBe("Boa base");
    expect(bandFor(100).label).toBe("Madura");
  });
});

const rows = [
  { control_id: "C01", status: "nao_atende" },
  { control_id: "C03", status: "nao_atende" },
  { control_id: "C06", status: "parcial" },
  { control_id: "C07", status: "sem_dado" },
  { control_id: "C02", status: "atende" },
];

describe("topRisks", () => {
  it("orders by weight, then severity, skips controls that are met", () => {
    expect(topRisks(rows).map((g) => g.id)).toEqual(["C03", "C06", "C07"]);
  });
  it("never exposes the fix steps (they live inside the product)", () => {
    for (const r of topRisks(rows)) expect(Object.keys(r)).toEqual(["id", "name", "why", "status"]);
  });
});

describe("countByStatus", () => {
  it("counts each status", () => {
    expect(countByStatus(rows)).toEqual({ atende: 1, parcial: 1, nao_atende: 2, sem_dado: 1 });
  });
});
