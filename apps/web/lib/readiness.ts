// "Prontidão para o questionário de seguradora": uma leitura simples do diagnóstico + das evidências enviadas.
// NÃO é parecer, certificação nem garantia de aceitação (CLAUDE.md §5). Só diz se a empresa já tem, para os
// controles que as seguradoras mais cobram, a resposta "atende" e uma prova guardada com data e SHA-256.
import base12 from "./base12.json";

export type ControlStatus = "atende" | "parcial" | "nao_atende" | "sem_dado";
export type ReadinessLevel = "pronta" | "quase" | "nao_pronta" | "sem_diagnostico";
export type PendingReason = "lacuna" | "parcial" | "sem_dado" | "sem_evidencia";

// Os controles que os questionários de seguro cibernético tratam como condição: acesso (MFA), proteção das
// máquinas (antivírus, atualizações), backup e teste de restauração, e plano de incidente.
export const ESSENTIAL_CONTROLS = ["C03", "C04", "C05", "C06", "C07", "C12"] as const;

const MIN_MET_FOR_ALMOST = 4;

export type Pending = { control: string; reason: PendingReason };
export type Readiness = {
  level: ReadinessLevel;
  essentialsMet: number;
  essentialsWithEvidence: number;
  essentialsTotal: number;
  pending: Pending[];
};

export function evaluateReadiness(controls: Record<string, ControlStatus | undefined>, evidenceControls: readonly string[]): Readiness {
  const total = ESSENTIAL_CONTROLS.length;
  if (Object.keys(controls).length === 0) {
    return { level: "sem_diagnostico", essentialsMet: 0, essentialsWithEvidence: 0, essentialsTotal: total, pending: [] };
  }
  const withEvidence = new Set(evidenceControls);
  const pending: Pending[] = [];
  let met = 0;
  let proved = 0;
  let hardGap = false;

  for (const control of ESSENTIAL_CONTROLS) {
    const status = controls[control] ?? "sem_dado";
    const hasProof = withEvidence.has(control);
    if (hasProof) proved++;
    if (status === "atende") {
      met++;
      if (!hasProof) pending.push({ control, reason: "sem_evidencia" });
      continue;
    }
    if (status === "nao_atende") {
      hardGap = true;
      pending.push({ control, reason: "lacuna" });
    } else {
      pending.push({ control, reason: status === "parcial" ? "parcial" : "sem_dado" });
    }
  }

  let level: ReadinessLevel;
  if (!hardGap && met === total && proved === total) level = "pronta";
  else if (!hardGap && met >= MIN_MET_FOR_ALMOST) level = "quase";
  else level = "nao_pronta";

  // Pendências mais graves primeiro: lacuna, parcial, sem dado, falta de prova.
  const order: PendingReason[] = ["lacuna", "parcial", "sem_dado", "sem_evidencia"];
  pending.sort((a, b) => order.indexOf(a.reason) - order.indexOf(b.reason) || a.control.localeCompare(b.control));
  return { level, essentialsMet: met, essentialsWithEvidence: proved, essentialsTotal: total, pending };
}

export const LEVEL_LABEL: Record<ReadinessLevel, string> = {
  pronta: "Pronta para responder",
  quase: "Quase pronta",
  nao_pronta: "Ainda não pronta",
  sem_diagnostico: "Diagnóstico não concluído",
};

export const LEVEL_CHIP: Record<ReadinessLevel, string> = {
  pronta: "bg-green-100 text-green-800",
  quase: "bg-amber-100 text-amber-800",
  nao_pronta: "bg-red-100 text-red-800",
  sem_diagnostico: "bg-slate-100 text-slate-600",
};

export const REASON_LABEL: Record<PendingReason, string> = {
  lacuna: "Lacuna: o controle não está em dia",
  parcial: "Parcial: está em dia só em parte",
  sem_dado: "Sem dado: ainda não foi respondido ou verificado",
  sem_evidencia: "Falta enviar a prova (evidência)",
};

const NAMES = new Map(base12.controles.map((c) => [c.id, c.nome]));
export const controlName = (id: string) => NAMES.get(id) ?? id;
