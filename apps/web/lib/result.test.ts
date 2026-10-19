import { describe, expect, it } from "vitest";
import { bandFor, topGaps } from "./result";

describe("bandFor", () => {
  it("maps score to the catalog bands", () => {
    expect(bandFor(0).label).toBe("Exposta");
    expect(bandFor(39).label).toBe("Exposta");
    expect(bandFor(40).label).toBe("Em construção");
    expect(bandFor(70).label).toBe("Boa base");
    expect(bandFor(100).label).toBe("Madura");
  });
});

describe("topGaps", () => {
  const rows = [
    { control_id: "C01", status: "nao_atende" },
    { control_id: "C03", status: "nao_atende" },
    { control_id: "C06", status: "parcial" },
    { control_id: "C07", status: "sem_dado" },
    { control_id: "C02", status: "atende" },
  ];
  it("orders by weight, then severity, skips controls that are met", () => {
    expect(topGaps(rows).map((g) => g.id)).toEqual(["C03", "C06", "C07"]);
  });
  it("returns the fix steps of each control", () => {
    expect(topGaps(rows)[0].steps.length).toBeGreaterThan(0);
  });
});
