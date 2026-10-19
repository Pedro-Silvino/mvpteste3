import base12 from "./base12.json";

export type Step = {
  id: string;
  title: string;
  question: string;
  help?: string;
  why?: string;
  options: { value: string; label: string }[];
};

const LABELS: Record<string, string> = {
  ...base12.rotulos_opcoes,
  tem: "Já tenho",
  vai_contratar: "Pretendo contratar",
  equipe_interna: "Equipe interna",
  prestador_externo: "Prestador externo",
  ninguem: "Ninguém",
  microsoft_365: "Microsoft 365 (Outlook)",
  google_workspace: "Google Workspace (Gmail)",
  outro: "Outro",
};

const EXTRA_TITLES: Record<string, string> = {
  Q_INCIDENTE: "Histórico",
  Q_TI: "Quem cuida da TI",
  Q_EMAIL: "E-mail da empresa",
  Q_SEGURO: "Seguro cibernético",
};

function toOptions(values: string[]) {
  return values.map((value) => ({ value, label: LABELS[value] ?? value }));
}

export function buildSteps(): Step[] {
  const extra: Step[] = base12.cadastro_extra.map((q) => ({
    id: q.id,
    title: EXTRA_TITLES[q.id] ?? q.id,
    question: q.pergunta,
    options: toOptions(q.opcoes),
  }));
  const controls: Step[] = base12.controles.map((c) => ({
    id: c.id,
    title: c.nome,
    question: c.pergunta,
    help: c.ajuda,
    why: c.por_que,
    options: toOptions(c.opcoes),
  }));
  return [...extra, ...controls];
}

const STEPS = buildSteps();

export function isValidAnswer(questionId: string, value: string): boolean {
  const step = STEPS.find((s) => s.id === questionId);
  return !!step && step.options.some((o) => o.value === value);
}

export function firstUnansweredIndex(steps: Step[], answers: Record<string, string>): number {
  const i = steps.findIndex((s) => !answers[s.id]);
  return i === -1 ? steps.length : i;
}
