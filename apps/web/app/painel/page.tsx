import Link from "next/link";
import { formatDateTime } from "@/lib/assessment-data";
import { getPainel } from "@/lib/painel-data";
import { planName } from "@/lib/plans";
import { bandFor, countByStatus } from "@/lib/result";
import { DownloadButton } from "../resultado/download-button";
import { ScoreRing } from "./score-ring";
import { Card, CHIP, Icon, PageHeader } from "./ui";

const LEVEL_CHIP = {
  Alto: "bg-red-100 text-red-800",
  Médio: "bg-amber-100 text-amber-800",
  Baixo: "bg-green-100 text-green-800",
  "Sem dado": "bg-slate-100 text-slate-600",
} as const;
const COUNT_LABEL = { atende: "atendem", parcial: "parciais", nao_atende: "não atendem", sem_dado: "sem dado" } as const;

function Kpi({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <Card className="flex flex-col">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-2 flex-1">{children}</div>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

export default async function VisaoGeralPage() {
  const p = await getPainel();
  const score = p.score as number;
  const band = bandFor(score);
  const counts = countByStatus(p.rows);
  const high = p.threats.filter((t) => t.level === "Alto").length;

  const steps = [
    { done: true, title: "Diagnóstico concluído", text: "Nota, riscos e relatório gratuito prontos.", href: "/painel/relatorio" },
    {
      done: p.profileComplete,
      title: p.profileComplete ? "Dados da empresa completos" : "Completar os dados da empresa",
      text: "Nome, CNPJ, setor e porte. Leva 1 minuto.",
      href: "/painel/empresa",
    },
    {
      done: p.paid,
      title: p.paid ? "Plano ativo" : p.requestedPlan ? "Pedido de plano enviado" : "Escolher um plano",
      text: p.paid ? `Plano ${planName(p.org.plan)}.` : p.requestedPlan ? "A equipe DataDops fala com você pelo e-mail da conta." : "Compare os planos e peça a proposta.",
      href: "/painel/planos",
    },
    { done: false, locked: !p.paid, title: "Ver as lacunas e como resolver", text: "Passo a passo para cada controle.", href: "/painel/riscos" },
    { done: false, locked: !p.paid, title: "Kits de documentos e coletor", text: "Política, plano de incidente e conferência dos computadores.", href: "/painel/documentos" },
  ];

  return (
    <>
      <PageHeader
        title="Visão geral"
        subtitle={`O retrato de segurança de ${p.org.domain ?? p.org.name}, com base nas suas respostas e na checagem pública.`}
        action={<DownloadButton compact />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Nota de maturidade" hint="Autoavaliada, de 0 a 100">
          <div className="flex items-center gap-4">
            <ScoreRing score={score} color={band.color} size={84} stroke={9} />
            <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: band.color }}>
              {band.label}
            </span>
          </div>
        </Kpi>
        <Kpi label="Exposição a ataques" hint="Dos 5 tipos de ataque analisados">
          <p className="font-[family-name:var(--font-archivo)] text-4xl font-extrabold text-n1">
            {high}
            <span className="ml-1 text-base font-semibold text-muted">em nível alto</span>
          </p>
        </Kpi>
        <Kpi label="Checagem pública" hint={p.scan ? `Feita em ${formatDateTime(p.scan.collectedAt)}` : "Ainda não concluída"}>
          <p className="font-[family-name:var(--font-archivo)] text-4xl font-extrabold text-n1">
            {p.scan?.score ?? "—"}
            {p.scan?.score != null && <span className="ml-1 text-base font-semibold text-muted">/100</span>}
          </p>
        </Kpi>
        <Kpi label="Seu plano" hint={p.paid ? "Acesso completo liberado" : "Relatório gratuito guardado"}>
          <p className="font-[family-name:var(--font-archivo)] text-2xl font-extrabold text-n1">{planName(p.org.plan)}</p>
          {p.requestedPlan && (
            <span className="mt-1 inline-block rounded-full bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-800">Pedido enviado</span>
          )}
        </Kpi>
      </div>

      {p.alerts.length > 0 && (
        <Card className="mb-4 border-amber-200 bg-amber-50/60">
          <h2 className="text-lg font-bold text-n1">Alertas ({p.alerts.length})</h2>
          <ul className="mt-3 space-y-2">
            {p.alerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start gap-2 text-sm">
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${a.severity === "critico" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                  {a.severity === "critico" ? "Crítico" : a.severity === "atencao" ? "Atenção" : "Aviso"}
                </span>
                <span className="min-w-0 flex-1 text-n1">{a.message}</span>
                <span className="text-xs text-muted">{formatDateTime(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-n1">Riscos a que a empresa está exposta</h2>
            <Link href="/painel/riscos" className="text-sm font-semibold text-teal hover:underline">
              Ver detalhes
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-line">
            {p.threats.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-n1">{t.name}</p>
                  <p className="truncate text-xs text-muted">{t.loss}</p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-0.5 text-xs font-semibold ${LEVEL_CHIP[t.level]}`}>
                  {t.level === "Sem dado" ? "Sem dado" : `Exposição ${t.level.toLowerCase()}`}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4 text-xs font-semibold">
            {(Object.keys(COUNT_LABEL) as (keyof typeof COUNT_LABEL)[]).map((s) => (
              <span key={s} className={`rounded-full px-3 py-1 ${CHIP[s]}`}>
                {counts[s]} {COUNT_LABEL[s]}
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-n1">Próximos passos</h2>
          <ol className="mt-4 space-y-4">
            {steps.map((s, i) => (
              <li key={s.title}>
                <Link href={s.href} className="group flex gap-3">
                  <span
                    className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      s.done ? "bg-teal text-white" : s.locked ? "bg-line text-muted" : "bg-ice text-teal"
                    }`}
                  >
                    {s.done ? <Icon name="check" className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-n1 group-hover:text-teal">{s.title}</span>
                    <span className="block text-xs text-muted">{s.text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {!p.paid && (
        <section className="relative mt-4 overflow-hidden rounded-2xl bg-n1 p-6 text-white sm:p-8">
          <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full bg-teal/25 blur-2xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-5">
            <div className="max-w-xl">
              <h2 className="text-xl font-bold">Quer saber exatamente o que corrigir?</h2>
              <p className="mt-2 text-sm text-ice">
                Nos planos pagos você vê as lacunas uma a uma, com o passo a passo, kits de documentos, orientações para a TI e o coletor
                dos computadores.
              </p>
            </div>
            <Link
              href="/painel/planos"
              className="rounded-xl bg-teal px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-sky hover:text-n1"
            >
              Escolher um plano
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
