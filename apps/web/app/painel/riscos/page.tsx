import { getPainel } from "@/lib/painel-data";
import { openGaps, STATUS_LABEL } from "@/lib/result";
import { ThreatSection } from "../../_components/threat-section";
import { Card, CHIP, LockedCard, PageHeader } from "../ui";

export const metadata = { title: "Riscos — Sentinela" };

export default async function RiscosPage() {
  const p = await getPainel();
  const gaps = p.paid ? openGaps(p.rows) : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Riscos"
        subtitle="Os tipos de ataque a que a empresa está exposta, o que podem custar e o que se ganha ao corrigir."
      />
      <ThreatSection threats={p.threats} />

      {p.paid ? (
        <Card>
          <h2 className="text-lg font-bold text-n1">Lacunas e como resolver</h2>
          <p className="mt-1 text-sm text-muted">
            {gaps.length === 0 ? "Nenhuma lacuna nas respostas." : `${gaps.length} controles pedem atenção, do mais importante ao menos.`}
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {gaps.map((g) => (
              <article key={g.id} className="rounded-xl border border-line border-l-4 border-l-teal p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">{g.area}</p>
                    <h3 className="font-bold leading-snug text-n1">
                      {g.id} · {g.name}
                    </h3>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-0.5 text-xs font-semibold ${CHIP[g.status]}`}>{STATUS_LABEL[g.status]}</span>
                </div>
                <p className="mt-2 text-sm text-muted">{g.why}</p>
                <ol className="mt-3 list-inside list-decimal space-y-1 text-sm text-ink">
                  {g.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </Card>
      ) : (
        <LockedCard
          title="Quais são as lacunas e como resolver cada uma"
          text="Aqui aparece a lista de controles em lacuna, do mais importante ao menos, com o passo a passo para corrigir cada um. Liberado em qualquer plano pago."
        />
      )}
    </div>
  );
}
