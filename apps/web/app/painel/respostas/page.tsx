import { getPainel } from "@/lib/painel-data";
import { buildSteps } from "@/lib/questionnaire";
import { Card, PageHeader } from "../ui";

export const metadata = { title: "Respostas — Sentinela" };

export default async function RespostasPage() {
  const p = await getPainel();
  const steps = buildSteps();
  const groups = [
    { title: "Sobre a empresa", steps: steps.filter((s) => s.id.startsWith("Q_")) },
    { title: "Os 12 controles", steps: steps.filter((s) => s.id.startsWith("C")) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Suas respostas" subtitle="O que você respondeu no questionário. Fica guardado junto com o relatório." />
      {groups.map((g) => (
        <Card key={g.title}>
          <h2 className="text-lg font-bold text-n1">{g.title}</h2>
          <dl className="mt-3 divide-y divide-line">
            {g.steps.map((s) => {
              const value = p.answers.get(s.id);
              const label = s.options.find((o) => o.value === value)?.label ?? "Sem resposta";
              return (
                <div key={s.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                  <dt className="max-w-xl text-sm text-muted">{s.question}</dt>
                  <dd className="shrink-0 rounded-full bg-ice px-3 py-1 text-sm font-semibold text-n1">{label}</dd>
                </div>
              );
            })}
          </dl>
        </Card>
      ))}
    </div>
  );
}
