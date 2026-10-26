import Link from "next/link";
import { controlName, LEVEL_CHIP, LEVEL_LABEL, REASON_LABEL, type Readiness } from "@/lib/readiness";
import { Card } from "./ui";

// "Prontidão para ciberseguro": how many of the controls insurers ask about are met and proved. Not an opinion
// and not a guarantee of acceptance (CLAUDE.md §5).
export function ReadinessCard({ readiness, canCollectEvidence }: { readiness: Readiness; canCollectEvidence: boolean }) {
  const next = readiness.pending.slice(0, 3);
  const needsProof = readiness.pending.some((p) => p.reason === "sem_evidencia");
  return (
    <Card className="mt-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold text-n1">Prontidão para o questionário de ciberseguro</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${LEVEL_CHIP[readiness.level]}`}>{LEVEL_LABEL[readiness.level]}</span>
      </div>
      <p className="mt-2 text-sm text-muted">
        {readiness.essentialsMet} de {readiness.essentialsTotal} controles que as seguradoras mais perguntam estão em dia, e{" "}
        {readiness.essentialsWithEvidence} têm prova guardada. É uma leitura das suas respostas e provas; não garante aceitação pela seguradora.
      </p>
      {next.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {next.map((p) => (
            <li key={p.control}>
              <b className="text-n1">
                {p.control} · {controlName(p.control)}
              </b>
              <span className="text-muted"> — {REASON_LABEL[p.reason]}</span>
            </li>
          ))}
        </ul>
      )}
      {needsProof && (
        <div className="mt-4">
          <Link href={canCollectEvidence ? "/painel/evidencias" : "/painel/planos"} className="btn-primary">
            {canCollectEvidence ? "Enviar provas" : "Ver como guardar as provas"}
          </Link>
        </div>
      )}
    </Card>
  );
}
