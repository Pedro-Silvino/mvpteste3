import { describe, expect, it } from "vitest";
import { ESSENTIAL_CONTROLS } from "./readiness";
import { clientReadiness, parseDetail, parseOverview, partnerLink } from "./partner-data";

const ORG = "11111111-1111-4111-8111-111111111111";

const shared = {
  org_id: ORG, domain: "empresa.com.br", created_at: "2026-10-26T10:00:00Z", shared: true, stage: "concluido",
  score: 72, external_score: 80, assessment_kind: "express", completed_at: "2026-10-26T10:05:00Z",
  controls: { C03: "atende", C04: "atende", C05: "atende", C06: "nao_atende", C07: "sem_dado", C12: "atende" },
  collector_devices: 2, evidence_controls: ["C03"],
};

describe("parseOverview", () => {
  it("reads a shared and an unshared client; the unshared one carries no diagnostic fields", () => {
    const r = parseOverview({
      partner: { name: "Corretora Dois", code: "corretora-dois-ab12cd", kind: "corretor" },
      clients: [shared, { org_id: "22222222-2222-4222-8222-222222222222", domain: "outra.com.br", created_at: "2026-10-25T10:00:00Z", shared: false, stage: "iniciado" }],
    });
    expect(r.partner.name).toBe("Corretora Dois");
    expect(r.clients).toHaveLength(2);
    expect(r.clients[0].score).toBe(72);
    expect(r.clients[1].score).toBeNull();
    expect(r.clients[1].controls).toEqual({});
  });

  it("refuses a malformed payload instead of rendering it", () => {
    expect(() => parseOverview({ partner: {}, clients: [] })).toThrow();
    expect(() => parseOverview({ partner: { name: "x", code: "abc", kind: "corretor" }, clients: [{ ...shared, stage: "hackeado" }] })).toThrow();
  });
});

describe("clientReadiness", () => {
  it("is computed only for shared clients", () => {
    const [c] = parseOverview({ partner: { name: "x", code: "abc", kind: "corretor" }, clients: [shared] }).clients;
    expect(clientReadiness(c)?.level).toBe("nao_pronta"); // C06 tem lacuna
    const [u] = parseOverview({
      partner: { name: "x", code: "abc", kind: "corretor" },
      clients: [{ org_id: ORG, domain: "a.com", created_at: "2026-10-25T10:00:00Z", shared: false, stage: "iniciado" }],
    }).clients;
    expect(clientReadiness(u)).toBeNull();
  });

  it("counts proofs only on essential controls", () => {
    const [c] = parseOverview({
      partner: { name: "x", code: "abc", kind: "corretor" },
      clients: [{ ...shared, controls: Object.fromEntries(ESSENTIAL_CONTROLS.map((k) => [k, "atende"])), evidence_controls: [...ESSENTIAL_CONTROLS, "C01"] }],
    }).clients;
    expect(clientReadiness(c)?.level).toBe("pronta");
  });
});

describe("parseDetail", () => {
  it("reads evidence metadata and never exposes a download path", () => {
    const d = parseDetail({
      org_id: ORG, domain: "empresa.com.br", name: "empresa.com.br", sector: null, employees_range: "11-50", plan: "express", created_at: "2026-10-26T10:00:00Z",
      score: 72, external_score: 80, assessment_kind: "express", completed_at: "2026-10-26T10:05:00Z",
      controls: { C03: "atende" }, collector_devices: 0, external_checks: { X01: "ok" },
      evidence: [{ control_id: "C03", file_name: "mfa.png", created_at: "2026-10-26T10:10:00Z", sha256: "aaaaaaaaaaaa" }],
    });
    expect(d.evidence[0]).toEqual({ control_id: "C03", file_name: "mfa.png", created_at: "2026-10-26T10:10:00Z", sha256: "aaaaaaaaaaaa" });
    expect(Object.keys(d)).not.toContain("storage_path");
  });
});

describe("partnerLink", () => {
  it("builds the referral link and rejects an invalid code", () => {
    expect(partnerLink("https://app.datadops.com.br/", "corretora-dois-ab12cd")).toBe("https://app.datadops.com.br/comecar?p=corretora-dois-ab12cd");
    expect(() => partnerLink("https://app.datadops.com.br", "Bad Code!")).toThrow();
  });
});
