import { describe, expect, it } from "vitest";
import { bandFor, countByStatus, openGaps } from "./result";

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

describe("openGaps", () => {
  it("lists every open control by weight, then severity, and skips the ones that are met", () => {
    expect(openGaps(rows).map((g) => g.id)).toEqual(["C03", "C06", "C07", "C01"]);
  });
  it("carries the fix steps", () => {
    expect(openGaps(rows)[0].steps.length).toBeGreaterThan(0);
  });
});

describe("countByStatus", () => {
  it("counts each status", () => {
    expect(countByStatus(rows)).toEqual({ atende: 1, parcial: 1, nao_atende: 2, sem_dado: 1 });
  });
});
