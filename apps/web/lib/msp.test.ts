import { describe, expect, it } from "vitest";
import { buildAccounts, filterAccounts, parseFilters, portfolioSummary, sortByAttention } from "./msp";
import { parseOverview } from "./partner-data";

const MET = { C03: "atende", C04: "atende", C05: "atende", C06: "atende", C07: "atende", C12: "atende" };

function client(id: string, over: Record<string, unknown>) {
  return {
    org_id: `${id.repeat(8)}-1111-4111-8111-111111111111`,
    domain: `${id}.com.br`,
    created_at: "2026-10-26T10:00:00Z",
    shared: true,
    stage: "concluido",
    score: 80,
    external_score: 70,
    assessment_kind: "express",
    completed_at: "2026-10-26T10:05:00Z",
    controls: MET,
    collector_devices: 0,
    evidence_controls: Object.keys(MET),
    ...over,
  };
}

const overview = parseOverview({
  partner: { name: "MSP Exemplo", code: "msp-exemplo", kind: "msp" },
  clients: [
    client("a", { score: 90 }), // pronta
    client("b", { score: 55, controls: { ...MET, C06: "nao_atende" }, evidence_controls: [] }), // não pronta
    client("c", { score: 70, evidence_controls: ["C03", "C04", "C05", "C06"] }), // quase
    client("d", { shared: false, stage: "iniciado", score: null, controls: {}, evidence_controls: [] }), // sem autorização
    client("e", { score: 30, controls: { ...MET, C03: "nao_atende" }, evidence_controls: [] }), // não pronta, pior nota
  ],
});
const built = buildAccounts(overview.clients);

describe("buildAccounts", () => {
  it("computes readiness only for accounts that authorized sharing", () => {
    expect(built.find((a) => a.client.domain === "d.com.br")?.readiness).toBeNull();
    expect(built.find((a) => a.client.domain === "a.com.br")?.readiness?.level).toBe("pronta");
    expect(built).toHaveLength(5);
  });
});

describe("sortByAttention", () => {
  it("puts the worst posture first and accounts without authorization last", () => {
    const order = sortByAttention(built).map((a) => a.client.domain);
    expect(order).toEqual(["e.com.br", "b.com.br", "c.com.br", "a.com.br", "d.com.br"]);
  });
  it("does not mutate the input", () => {
    const copy = [...built];
    sortByAttention(built);
    expect(built).toEqual(copy);
  });
});

describe("portfolioSummary", () => {
  it("counts accounts and averages only visible scores", () => {
    const s = portfolioSummary(built);
    expect(s).toMatchObject({ total: 5, visible: 4, pending_authorization: 1, pronta: 1, quase: 1, nao_pronta: 2 });
    expect(s.average_score).toBe(Math.round((90 + 55 + 70 + 30) / 4));
  });
  it("has no average without visible accounts", () => {
    expect(portfolioSummary(built.filter((a) => !a.client.shared)).average_score).toBeNull();
    expect(portfolioSummary([]).total).toBe(0);
  });
});

describe("filters", () => {
  it("parses only known values and ignores the rest", () => {
    expect(parseFilters({ nivel: "quase", conta: "x" })).toEqual({ nivel: "quase", conta: null });
    expect(parseFilters({ nivel: "hack" })).toEqual({ nivel: null, conta: null });
    expect(parseFilters({ conta: built[0].client.org_id }).conta).toBe(built[0].client.org_id);
    expect(parseFilters({ nivel: ["pronta", "quase"] }).nivel).toBeNull();
  });
  it("filters by readiness level, and 'sem_autorizacao' for the unshared", () => {
    expect(filterAccounts(built, { nivel: "nao_pronta", conta: null })).toHaveLength(2);
    expect(filterAccounts(built, { nivel: "sem_autorizacao", conta: null }).map((a) => a.client.domain)).toEqual(["d.com.br"]);
    expect(filterAccounts(built, { nivel: null, conta: null })).toHaveLength(5);
  });
});
