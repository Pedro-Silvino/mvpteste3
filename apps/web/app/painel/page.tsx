import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDateTime, latestExternalScan } from "@/lib/assessment-data";
import { isPaidPlan, planName, type PaidPlanId } from "@/lib/plans";
import { currentOrgId } from "@/lib/org";
import { buildSteps } from "@/lib/questionnaire";
import { bandFor, openGaps, STATUS_LABEL } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";
import { threatExposure } from "@/lib/threats";
import { ThreatSection } from "../_components/threat-section";
import { AutoRefresh } from "../resultado/auto-refresh";
import { DownloadButton } from "../resultado/download-button";
import { PlanCards } from "./plan-cards";

export const metadata = { title: "Painel — Sentinela" };

const card = "rounded-3xl bg-white p-6 shadow-lg shadow-n3/10 sm:p-8";
const CHIP: Record<string, string> = {
  atende: "bg-green-100 text-green-800",
  parcial: "bg-amber-100 text-amber-800",
  nao_atende: "bg-red-100 text-red-800",
  sem_dado: "bg-slate-100 text-slate-600",
};
const KITS = [
  { name: "Política de segurança", text: "Regras de uso de computadores, senhas e dados, prontas para ajustar e aprovar." },
  { name: "Plano de incidente", text: "O que fazer, quem avisar e em quanto tempo se houver um ataque." },
  { name: "Designação do responsável", text: "Carta que nomeia quem cuida da segurança da empresa." },
];

export default async function PainelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/comecar");

  const orgId = await currentOrgId(supabase, user.id);
  if (!orgId) redirect("/comecar");
  const { data: org } = await supabase.from("organizations").select("id, name, domain, plan").eq("id", orgId).maybeSingle();
  if (!org) redirect("/comecar");

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, status, score, completed_at")
    .eq("org_id", org.id)
    .eq("kind", "express")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!assessment) redirect("/comecar");
  if (assessment.status === "rascunho") redirect("/diagnostico");

  const paid = isPaidPlan(org.plan);
  const [{ data: report }, { data: answers }, { data: results }, { data: requests }] = await Promise.all([
    supabase.from("reports").select("created_at").eq("assessment_id", assessment.id).eq("kind", "express").limit(1).maybeSingle(),
    supabase.from("answers").select("question_id, value").eq("assessment_id", assessment.id),
    // Feeds the threat overview for everyone; the per-control gaps with fix steps are only built for paid plans.
    supabase.from("control_results").select("control_id, status").eq("assessment_id", assessment.id),
    supabase
      .from("alerts")
      .select("message")
      .eq("org_id", org.id)
      .is("resolved_at", null)
      .like("message", "Pedido de proposta:%")
      .limit(1),
  ]);

  const scan = await latestExternalScan(supabase, org.id);
  const threats = threatExposure(results ?? [], scan?.checks);
  const ready = assessment.status === "concluido" && assessment.score !== null && !!report;
  const band = ready ? bandFor(assessment.score as number) : null;
  const gaps = paid ? openGaps(results ?? []) : [];
  const requestedPlan = (requests?.[0]?.message.split("plano ")[1] as PaidPlanId | undefined) ?? null;
  const steps = buildSteps();
  const answerMap = new Map((answers ?? []).map((a) => [a.question_id, a.value]));
  const savedOn = report ? new Date(report.created_at).toLocaleDateString("pt-BR") : null;

  return (
    <main className="flex-1 bg-ice px-4 py-8 sm:py-12">
      {!ready && assessment.status !== "erro" && <AutoRefresh everyMs={1500} />}
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Painel Sentinela</p>
            <h1 className="text-2xl font-bold text-n1">{org.domain ?? org.name}</h1>
          </div>
          <span className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-n3 shadow-sm">
            Plano {planName(org.plan)}
          </span>
        </header>

        {user.is_anonymous && (
          <p className="rounded-2xl bg-white px-5 py-3 text-sm text-n1 shadow-sm">
            Este painel está só neste navegador.{" "}
            <Link href="/conta" className="font-semibold text-teal underline">
              Salve com e-mail e senha
            </Link>{" "}
            para voltar a ele depois.
          </p>
        )}

        <section className={card}>
          <h2 className="text-xl font-bold text-n1">Seu relatório</h2>
          {ready && band ? (
            <div className="mt-4 flex flex-wrap items-center gap-6">
              <div
                className="grid h-28 w-28 shrink-0 place-items-center rounded-full border-8"
                style={{ borderColor: band.color }}
              >
                <div className="text-center">
                  <div className="text-4xl font-extrabold leading-none text-n1">{assessment.score}</div>
                  <div className="text-xs text-muted">de 100</div>
                </div>
              </div>
              <div className="flex-1">
                <p>
                  <span className="rounded-full px-3 py-1 text-sm font-bold text-white" style={{ backgroundColor: band.color }}>
                    {band.label}
                  </span>
                  <span className="ml-2 rounded-full border border-teal px-3 py-0.5 text-xs font-semibold text-teal">
                    Autoavaliado
                  </span>
                </p>
                <p className="mt-2 text-sm text-muted">
                  Guardado em {savedOn}. {paid ? "Relatório completo, com as lacunas e como resolver." : "Relatório gratuito: nota e totais."}
                </p>
                <DownloadButton />
              </div>
            </div>
          ) : (
            <p className="mt-3 text-muted">
              {assessment.status === "erro"
                ? "Não conseguimos gerar o relatório. A equipe DataDops já foi avisada."
                : "Estamos montando o seu relatório. Esta página atualiza sozinha."}
            </p>
          )}
        </section>

        {ready && <ThreatSection threats={threats} />}

        {scan && (
          <section className={card}>
            <h2 className="text-xl font-bold text-n1">Checagem pública do domínio</h2>
            <p className="mt-2 text-sm text-muted">
              Feita em <b className="text-n1">{formatDateTime(scan.collectedAt)}</b> em {scan.domain}: e-mail (SPF, DMARC e
              DKIM), certificado, redirecionamento para HTTPS e cabeçalhos do site, só com consultas públicas.
              {scan.score !== null ? " Nota externa: " + scan.score + "/100." : ""}
            </p>
          </section>
        )}

        {paid ? (
          <>
            <section className={card}>
              <h2 className="text-xl font-bold text-n1">Lacunas e como resolver</h2>
              <p className="mt-1 text-sm text-muted">
                {gaps.length === 0 ? "Nenhuma lacuna nas respostas." : `${gaps.length} controles pedem atenção, do mais importante ao menos.`}
              </p>
              <div className="mt-5 space-y-3">
                {gaps.map((g) => (
                  <div key={g.id} className="rounded-2xl border border-line border-l-4 border-l-teal p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-bold text-n1">
                        {g.id} · {g.name}
                      </h3>
                      <span className={`shrink-0 rounded-full px-3 py-0.5 text-xs font-semibold ${CHIP[g.status]}`}>
                        {STATUS_LABEL[g.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">{g.why}</p>
                    <ol className="mt-3 list-inside list-decimal space-y-1 text-sm text-ink">
                      {g.steps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </section>

            <section className={card}>
              <h2 className="text-xl font-bold text-n1">Kits de documentos e orientações</h2>
              <p className="mt-1 text-sm text-muted">
                Modelos para ajustar e aprovar. A equipe DataDops libera cada kit para a sua empresa.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {KITS.map((k) => (
                  <div key={k.name} className="rounded-2xl border border-line p-4">
                    <h3 className="font-bold text-n1">{k.name}</h3>
                    <p className="mt-1 text-sm text-muted">{k.text}</p>
                    <p className="mt-3 text-xs font-semibold text-amber-700">Em preparação para você</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-line p-4">
                <h3 className="font-bold text-n1">Coletor dos computadores</h3>
                <p className="mt-1 text-sm text-muted">
                  Programa que a TI roda uma vez para conferir antivírus, atualizações e criptografia, e atualizar o status
                  das lacunas sozinho. Não pede senha de ninguém.
                </p>
                <p className="mt-2 text-xs font-semibold text-amber-700">Em preparação para você</p>
              </div>
            </section>
          </>
        ) : (
          <section className="rounded-3xl bg-n1 p-6 text-white shadow-lg shadow-n3/20 sm:p-8">
            <h2 className="text-xl font-bold">Lacunas e como resolver</h2>
            <p className="mt-2 text-ice">
              Seu diagnóstico encontrou pontos a corrigir. Nos planos pagos você vê quais são, um a um, com o passo a passo,
              kits de documentos, orientações e o coletor dos computadores.
            </p>
            <a href="#planos" className="mt-5 inline-block rounded-xl bg-teal px-6 py-3 font-semibold text-white hover:bg-sky hover:text-n1">
              Ver os planos
            </a>
          </section>
        )}

        <section id="planos" className={card}>
          <h2 className="text-xl font-bold text-n1">Planos</h2>
          <p className="mt-1 mb-5 text-sm text-muted">Proposta sob medida para o tamanho da sua empresa. Sem compromisso.</p>
          <PlanCards orgId={org.id} currentPlan={org.plan} requestedPlan={requestedPlan} anonymous={!!user.is_anonymous} />
        </section>

        <section className={card}>
          <details>
            <summary className="cursor-pointer text-xl font-bold text-n1">Suas respostas</summary>
            <p className="mt-2 text-sm text-muted">O que você respondeu no questionário. Guardado junto com o relatório.</p>
            <dl className="mt-4 divide-y divide-line">
              {steps.map((s) => {
                const value = answerMap.get(s.id);
                const label = s.options.find((o) => o.value === value)?.label ?? "Sem resposta";
                return (
                  <div key={s.id} className="py-3">
                    <dt className="text-sm text-muted">{s.question}</dt>
                    <dd className="mt-0.5 font-semibold text-n1">{label}</dd>
                  </div>
                );
              })}
            </dl>
          </details>
        </section>

        <p className="px-2 text-center text-xs text-muted">
          Retrato do ambiente na data da coleta. Não substitui análise jurídica nem garante aceitação ou indenização por
          seguradora. As declarações feitas à seguradora são de responsabilidade da empresa.
        </p>
      </div>
    </main>
  );
}
