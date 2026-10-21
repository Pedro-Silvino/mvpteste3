import { formatDateTime } from "@/lib/assessment-data";
import { getPainel } from "@/lib/painel-data";
import { planName } from "@/lib/plans";
import { bandFor } from "@/lib/result";
import { DownloadButton } from "../../resultado/download-button";
import { ScoreRing } from "../score-ring";
import { Card, LockedCard, PageHeader } from "../ui";

export const metadata = { title: "Relatório — Sentinela" };

const ERRORS: Record<string, string> = {
  download: "Não conseguimos preparar o download agora. Tente de novo em instantes.",
  "sem-relatorio": "O relatório ainda não está disponível. Aguarde alguns instantes.",
};

const KIND_LABEL = (kind: string, path: string) =>
  kind === "mensal"
    ? "Relatório mensal"
    : kind === "completo"
      ? "Diagnóstico completo, com dados do coletor"
      : path.endsWith("-completo.pdf")
        ? "Diagnóstico completo (respostas)"
        : "Diagnóstico gratuito";

export default async function RelatorioPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const p = await getPainel();
  const score = p.score as number;
  const band = bandFor(score);
  const FREE = ["Nota de maturidade e faixa", "Quantos controles atendem, estão parciais ou sem dado", "Nota da checagem pública do e-mail e do site", "Tipos de ataque, prejuízo possível e oportunidades"];
  const FULL = ["Tudo do relatório gratuito", "Lista de lacunas, uma a uma, com o passo a passo para corrigir", "Resultado detalhado de cada checagem pública", "Os 12 controles com a situação de cada um"];

  return (
    <div className="space-y-5">
      <PageHeader title="Relatório" subtitle="O seu diagnóstico fica guardado aqui, junto com as respostas que deram origem a ele." />

      <Card>
        <div className="flex flex-wrap items-center gap-6">
          <ScoreRing score={score} color={band.color} size={128} stroke={12} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full px-3 py-1 text-sm font-bold text-white" style={{ backgroundColor: band.color }}>
                {band.label}
              </span>
              <span className="rounded-full border border-teal px-3 py-0.5 text-xs font-semibold text-teal-strong">Autoavaliado</span>
            </div>
            <p className="mt-2 text-sm text-muted">
              Diagnóstico Express de {p.org.domain ?? p.org.name}, guardado em{" "}
              <b className="text-n1">{p.savedOn ? formatDateTime(p.savedOn) : "—"}</b>.
              {p.scan && <> Checagem pública feita em {formatDateTime(p.scan.collectedAt)}.</>}
            </p>
            <p className="mt-1 text-sm text-muted">
              Formato do arquivo: <b className="text-n1">{p.paid ? "relatório completo" : "relatório gratuito"}</b> (plano {planName(p.org.plan)}).
            </p>
            <div className="mt-4">
              <DownloadButton compact />
            </div>
            {erro && ERRORS[erro] && (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {ERRORS[erro]}
              </p>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold text-n1">Relatório gratuito</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink">
            {FREE.map((i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-teal-strong">✓</span>
                {i}
              </li>
            ))}
          </ul>
        </Card>
        <Card className={p.paid ? "" : "opacity-80"}>
          <h2 className="text-lg font-bold text-n1">Relatório completo {p.paid ? "" : "· planos pagos"}</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink">
            {FULL.map((i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className={p.paid ? "text-teal-strong" : "text-muted"}>{p.paid ? "✓" : "•"}</span>
                {i}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {p.paid && p.history.length > 0 && (
        <Card>
          <h2 className="text-lg font-bold text-n1">Histórico de relatórios</h2>
          <ul className="mt-3 divide-y divide-line">
            {p.history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-semibold text-n1">{KIND_LABEL(h.kind, h.storage_path)}</p>
                  <p className="text-xs text-muted">{formatDateTime(h.created_at)}</p>
                </div>
                <a href={`/painel/relatorio/arquivo?id=${h.id}`} className="text-xs font-semibold text-teal-strong hover:underline">
                  Baixar PDF
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!p.paid && (
        <LockedCard
          title="Receba o relatório completo"
          text="Com um plano pago o mesmo botão de download entrega o relatório com todas as lacunas e como resolver."
        />
      )}
    </div>
  );
}
