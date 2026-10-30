import { describe, expect, it } from "vitest";
import { exportApprovedCsv, matchQuestions, type VaultItem } from "./questionnaire-matcher";

const NOW = new Date("2026-10-30T12:00:00Z");
const ev = (id: string, category: string, created_at: string, title = `Doc ${id}`): VaultItem => ({
  id,
  title,
  category,
  file_hash_sha256: id.repeat(64).slice(0, 64),
  created_at,
});

const VAULT = [
  ev("a", "backup", "2026-09-01T00:00:00Z", "Política de backup"),
  ev("b", "backup", "2026-10-01T00:00:00Z", "Relatório do último backup"),
  ev("c", "mfa", "2025-01-01T00:00:00Z", "Print do MFA"),
];

describe("matchQuestions", () => {
  it("maps a question to a category and picks the newest evidence", () => {
    const [m] = matchQuestions([{ id: "Q1", text: "A empresa faz backup das informações e testa a restauração?" }], VAULT, NOW);
    expect(m.category).toBe("backup");
    expect(m.status).toBe("sugerida");
    expect(m.evidence?.id).toBe("b");
    expect(m.evidence?.sha256).toBe("b".repeat(64));
    expect(m.confidence).toBe("alta");
  });

  it("is deterministic: same input, same output", () => {
    const q = [{ id: "Q1", text: "Há autenticação multifator (MFA) para acesso remoto?" }];
    expect(matchQuestions(q, VAULT, NOW)).toEqual(matchQuestions(q, VAULT, NOW));
  });

  it("ignores accents and case", () => {
    const [m] = matchQuestions([{ id: "Q", text: "AUTENTICAÇÃO EM DOIS FATORES está ativa?" }], VAULT, NOW);
    expect(m.category).toBe("mfa");
  });

  it("flags old evidence as stale and lowers confidence", () => {
    const [m] = matchQuestions([{ id: "Q", text: "Usa MFA?" }], VAULT, NOW);
    expect(m.status).toBe("sugerida");
    expect(m.stale).toBe(true);
    expect(m.confidence).toBe("baixa");
  });

  it("says there is no evidence instead of inventing an answer", () => {
    const [m] = matchQuestions([{ id: "Q", text: "Existe plano de continuidade de negócios?" }], VAULT, NOW);
    expect(m.category).toBe("continuidade");
    expect(m.status).toBe("sem_evidencia");
    expect(m.evidence).toBeNull();
    expect(m.suggestedAnswer).toBeNull();
  });

  it("leaves unrelated questions without a category", () => {
    const [m] = matchQuestions([{ id: "Q", text: "Qual a cor do logotipo?" }], VAULT, NOW);
    expect(m.category).toBeNull();
    expect(m.status).toBe("sem_categoria");
  });

  it("gives an auditable trace with the hash", () => {
    const [m] = matchQuestions([{ id: "Q", text: "Faz backup?" }], VAULT, NOW);
    expect(m.trace).toContain("categoria=backup");
    expect(m.trace).toContain(`sha256=${"b".repeat(64)}`);
  });

  it("never uses forbidden marketing wording", () => {
    const out = JSON.stringify(matchQuestions([{ id: "Q", text: "Faz backup?" }], VAULT, NOW)).toLowerCase();
    for (const w of ["100% seguro", "empresa segura", "risco zero", "certificad"]) expect(out).not.toContain(w);
  });
});

describe("exportApprovedCsv", () => {
  it("exports only approved suggestions, with evidence hash, and escapes quotes", () => {
    const ms = matchQuestions(
      [
        { id: "Q1", text: 'Faz "backup"?' },
        { id: "Q2", text: "Usa MFA?" },
      ],
      VAULT,
      NOW,
    );
    const csv = exportApprovedCsv(ms, new Set(["Q1"]));
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("id,pergunta,resposta,evidencia,sha256");
    expect(lines[1]).toContain('"Faz ""backup""?"');
    expect(lines[1]).toContain("b".repeat(64));
  });
  it("neutralises spreadsheet formulas", () => {
    const ms = matchQuestions([{ id: "=1+1", text: "=HYPERLINK(x) backup?" }], VAULT, NOW);
    const csv = exportApprovedCsv(ms, new Set(["=1+1"]));
    expect(csv).not.toMatch(/(^|,|")=/m);
  });
});
