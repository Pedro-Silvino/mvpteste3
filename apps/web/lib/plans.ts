// Plans from docs/PRODUTO.md §2. No prices on screen (CLAUDE.md §5, D10): "Proposta sob medida".
// "express" is the free tier; the other three are paid and activated by the DataDops team.
export type PlanId = "express" | "essencial" | "dossie" | "360";
export const PAID_PLANS = ["essencial", "dossie", "360"] as const;
export type PaidPlanId = (typeof PAID_PLANS)[number];

export type Plan = { id: PlanId; name: string; forWho: string; includes: string[] };

export const PLANS: Plan[] = [
  {
    id: "express",
    name: "Grátis",
    forWho: "Para conhecer a nota da sua empresa",
    includes: [
      "Nota de maturidade em segurança",
      "Checagem pública do e-mail e do site",
      "Relatório gratuito em PDF",
      "Relatório e respostas guardados no painel",
    ],
  },
  {
    id: "essencial",
    name: "Essencial",
    forWho: "Até cerca de 50 funcionários",
    includes: [
      "Tudo do Grátis",
      "Quais são as lacunas, uma a uma, e como resolver cada uma",
      "Kits de documentos e orientações para a TI",
      "Coletor que confere os computadores da empresa",
      "Relatório mensal e alertas quando algo piora",
    ],
  },
  {
    id: "dossie",
    name: "Dossiê Prova",
    forWho: "Quem precisa provar a alguém (seguradora, cliente grande)",
    includes: [
      "Tudo do Essencial",
      "Revisão da equipe DataDops e selo Verificado",
      "Dossiê com evidências, em projeto de 30 dias",
    ],
  },
  {
    id: "360",
    name: "DataDops 360",
    forWho: "Média empresa, com acompanhamento",
    includes: ["Tudo do Dossiê Prova", "Revisão mensal pela equipe DataDops", "Acompanhamento contínuo"],
  },
];

export function isPaidPlan(plan: string | null | undefined): boolean {
  return !!plan && (PAID_PLANS as readonly string[]).includes(plan);
}

export function planName(plan: string | null | undefined): string {
  return PLANS.find((p) => p.id === plan)?.name ?? "Grátis";
}
