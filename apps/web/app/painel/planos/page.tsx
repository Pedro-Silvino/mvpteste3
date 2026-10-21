import { getPainel } from "@/lib/painel-data";
import { PlanCards } from "../plan-cards";
import { PageHeader } from "../ui";

export const metadata = { title: "Planos — Sentinela" };

export default async function PlanosPage() {
  const p = await getPainel();
  return (
    <div className="space-y-5">
      <PageHeader
        title="Planos"
        subtitle="Escolha como quer seguir. A proposta é sob medida para o tamanho da sua empresa e sem compromisso: a equipe DataDops entra em contato e libera o acesso."
      />
      <PlanCards orgId={p.org.id} currentPlan={p.org.plan} requestedPlan={p.requestedPlan} anonymous={p.user.anonymous} />
    </div>
  );
}
