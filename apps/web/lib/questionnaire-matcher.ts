import type { ParsedQuestion } from "./questionnaire-parser";

// Deterministic matching: fixed keyword rules decide the category of a question, and the newest piece of
// evidence in that category is suggested. No scoring model, so the same input always gives the same output
// and every suggestion carries the evidence id and SHA-256 for audit. The customer approves each one.
export type VaultItem = { id: string; title: string; category: string; file_hash_sha256: string; created_at: string };

export type Match = {
  questionId: string;
  text: string;
  category: string | null;
  terms: string[];
  status: "sugerida" | "sem_evidencia" | "sem_categoria";
  evidence: { id: string; title: string; sha256: string; created_at: string } | null;
  suggestedAnswer: string | null;
  confidence: "alta" | "media" | "baixa" | null;
  stale: boolean;
  trace: string;
};

// "word" matches the whole word; "stem*" matches any word starting with the stem. Input is accent-free lowercase.
export const RULES: { category: string; terms: string[] }[] = [
  { category: "mfa", terms: ["mfa", "2fa", "multifator*", "multi fator*", "dois fatores", "duplo fator", "duas etapas"] },
  { category: "backup", terms: ["backup*", "copia de seguranca", "copias de seguranca", "restauracao", "restore"] },
  { category: "patch", terms: ["patch*", "atualizac*", "atualizado*", "vulnerabilidade*", "correcoes de seguranca"] },
  { category: "politica", terms: ["politica de seguranca", "politicas de seguranca", "psi", "politica formal"] },
  { category: "continuidade", terms: ["continuidade*", "plano de incidente*", "resposta a incidente*", "recuperacao de desastre*", "disaster recovery", "bcp", "rto", "rpo", "plano de contingencia"] },
  { category: "treinamento", terms: ["treinamento*", "conscientizacao", "capacitacao", "awareness", "phishing simulado"] },
  { category: "contrato", terms: ["contrato*", "clausula*", "dpa", "acordo de confidencialidade", "nda"] },
  { category: "laudo", terms: ["pentest", "teste de invasao", "laudo*", "auditoria*"] },
];

const STALE_DAYS = 365;

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function hits(padded: string, terms: string[]): string[] {
  return terms.filter((t) => (t.endsWith("*") ? padded.includes(` ${t.slice(0, -1)}`) : padded.includes(` ${t} `)));
}

const brDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export function matchQuestions(questions: ParsedQuestion[], vault: VaultItem[], now: Date = new Date()): Match[] {
  const newestFirst = [...vault].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : a.id < b.id ? -1 : 1));
  return questions.map((q) => {
    const padded = ` ${normalize(q.text)} `;
    let best: { category: string; terms: string[] } | null = null;
    for (const rule of RULES) {
      const found = hits(padded, rule.terms);
      if (found.length > (best?.terms.length ?? 0)) best = { category: rule.category, terms: found };
    }
    const base = { questionId: q.id, text: q.text, category: best?.category ?? null, terms: best?.terms ?? [] };
    if (!best) {
      return { ...base, status: "sem_categoria", evidence: null, suggestedAnswer: null, confidence: null, stale: false, trace: "categoria=nenhuma" } satisfies Match;
    }
    const item = newestFirst.find((v) => v.category === best.category);
    if (!item) {
      return { ...base, status: "sem_evidencia", evidence: null, suggestedAnswer: null, confidence: null, stale: false, trace: `categoria=${best.category}; termos=${best.terms.join("|")}; evidencia=nenhuma` } satisfies Match;
    }
    const ageDays = (now.getTime() - new Date(item.created_at).getTime()) / 86_400_000;
    const stale = ageDays > STALE_DAYS;
    const confidence = stale ? "baixa" : best.terms.length >= 2 ? "alta" : "media";
    return {
      ...base,
      status: "sugerida",
      evidence: { id: item.id, title: item.title, sha256: item.file_hash_sha256, created_at: item.created_at },
      suggestedAnswer: `Sim. Evidência registrada em ${brDate(item.created_at)}: ${item.title}.`,
      confidence,
      stale,
      trace: `categoria=${best.category}; termos=${best.terms.join("|")}; evidencia=${item.id}; sha256=${item.file_hash_sha256}`,
    } satisfies Match;
  });
}

// A cell that starts with = + - @ would run as a formula in a spreadsheet: prefix it with an apostrophe.
const cell = (v: string) => {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
};

export function exportApprovedCsv(matches: Match[], approved: Set<string>): string {
  const lines = ["id,pergunta,resposta,evidencia,sha256"];
  for (const m of matches) {
    if (!approved.has(m.questionId) || !m.evidence || !m.suggestedAnswer) continue;
    lines.push([m.questionId, m.text, m.suggestedAnswer, m.evidence.title, m.evidence.sha256].map(cell).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
