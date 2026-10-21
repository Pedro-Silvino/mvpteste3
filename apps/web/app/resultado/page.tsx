import Link from "next/link";
import { redirect } from "next/navigation";
import { bandFor, countByStatus, STATUS_LABEL, topRisks } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";
import { AutoRefresh } from "./auto-refresh";
import { DownloadButton } from "./download-button";
import { Offer } from "./offer";

export const metadata = { title: "Resultado — Sentinela" };

const card = "rounded-3xl bg-white p-6 shadow-lg shadow-n3/10 sm:p-9";
const DOWNLOAD_ERRORS: Record<string, string> = {
  download: "Não conseguimos preparar o download agora. Tente de novo em instantes.",
  "sem-relatorio": "O relatório ainda não está disponível. Aguarde alguns instantes.",
};
const CHIP: Record<string, string> = {
  atende: "bg-green-100 text-green-800",
  parcial: "bg-amber-100 text-amber-800",
  nao_atende: "bg-red-100 text-red-800",
  sem_dado: "bg-slate-100 text-slate-600",
};

export default async function ResultadoPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/comecar");

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, org_id, status, score, external_score")
    .eq("kind", "express")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!assessment) redirect("/comecar");
  if (assessment.status === "rascunho") redirect("/diagnostico");

  const { data: report } = await supabase
    .from("reports")
    .select("id")
    .eq("assessment_id", assessment.id)
    .eq("kind", "express")
    .limit(1)
    .maybeSingle();

  const ready = assessment.status === "concluido" && assessment.score !== null && !!report;

  if (!ready) {
    return (
      <main className="flex flex-1 items-center justify-center bg-ice px-4 py-12">
        {assessment.status !== "erro" && <AutoRefresh />}
        <div className={`${card} w-full max-w-xl text-center`}>
          {assessment.status !== "erro" && (
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-ice border-t-teal" />
          )}
          <h1 className="mt-6 text-2xl font-bold text-n1">
            {assessment.status === "erro" ? "Algo deu errado" : "Montando o seu relatório…"}
          </h1>
          <p className="mt-2 text-muted">
            {assessment.status === "erro"
              ? "Não conseguimos gerar o relatório. A equipe DataDops já foi avisada; tente de novo em alguns minutos."
              : "Estamos checando o e-mail e o site e calculando a sua nota. Leva menos de um minuto, não precisa recarregar."}
          </p>
        </div>
      </main>
    );
  }

  const score = assessment.score as number;
  const band = bandFor(score);
  const [{ data: rows }, { data: requests }] = await Promise.all([
    supabase.from("control_results").select("control_id, status").eq("assessment_id", assessment.id),
    supabase
      .from("alerts")
      .select("id")
      .eq("org_id", assessment.org_id)
      .is("resolved_at", null)
      .like("message", "Pedido de proposta:%")
      .limit(1),
  ]);
  const counts = countByStatus(rows ?? []);
  const risks = topRisks(rows ?? []);

  return (
    <main className="flex flex-1 justify-center bg-ice px-4 py-8 sm:py-12">
      <div className="w-full max-w-2xl space-y-5">
        <section className={`${card} text-center`}>
          <p className="text-sm font-medium text-muted">Sua nota de maturidade em segurança</p>
          <div
            className="mx-auto mt-5 grid h-40 w-40 place-items-center rounded-full border-[10px]"
            style={{ borderColor: band.color }}
          >
            <div>
              <div className="text-5xl font-extrabold leading-none text-n1">{score}</div>
              <div className="mt-1 text-xs text-muted">de 100</div>
            </div>
          </div>
          <p className="mt-5">
            <span className="rounded-full px-4 py-1.5 font-bold text-white" style={{ backgroundColor: band.color }}>
              {band.label}
            </span>
            <span className="ml-2 rounded-full border border-teal px-3 py-1 text-xs font-semibold text-teal">
              Autoavaliado
            </span>
          </p>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted">
            Resume quantos dos 12 controles mínimos de segurança a empresa declarou ter. Controles mais importantes
            valem mais.
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs font-semibold">
            {(["atende", "parcial", "nao_atende", "sem_dado"] as const).map((s) => (
              <span key={s} className={`rounded-full px-3 py-1 ${CHIP[s]}`}>
                {counts[s]} {s === "atende" ? "atendem" : s === "parcial" ? "parciais" : s === "nao_atende" ? "não atendem" : "sem dado"}
              </span>
            ))}
          </div>
          {assessment.external_score !== null && (
            <p className="mt-3 text-xs text-muted">
              Checagem pública do e-mail e do site: {assessment.external_score}/100 (consultas públicas, não altera a nota).
            </p>
          )}

          <DownloadButton />
          {erro && DOWNLOAD_ERRORS[erro] && (
            <p role="alert" className="mx-auto mt-4 max-w-md rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {DOWNLOAD_ERRORS[erro]}
            </p>
          )}
        </section>

        {risks.length > 0 && (
          <section className={card}>
            <h2 className="text-xl font-bold text-n1">Principais riscos identificados</h2>
            <p className="mt-1 text-sm text-muted">Os 3 pontos que mais pesam na sua nota.</p>
            <div className="mt-5 space-y-3">
              {risks.map((r) => (
                <div key={r.id} className="rounded-2xl border border-line border-l-4 border-l-teal p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-n1">{r.name}</h3>
                    <span className={`shrink-0 rounded-full px-3 py-0.5 text-xs font-semibold ${CHIP[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{r.why}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <Offer orgId={assessment.org_id} anonymous={!!user.is_anonymous} requested={(requests?.length ?? 0) > 0} />

        {user.is_anonymous && (
          <p className="px-2 text-center text-sm text-muted">
            Quer voltar a este resultado depois?{" "}
            <Link href="/conta" className="font-semibold text-teal underline">
              Salve o diagnóstico com e-mail e senha
            </Link>
            .
          </p>
        )}

        <p className="px-2 text-center text-xs text-muted">
          Retrato do ambiente na data da coleta. Não substitui análise jurídica nem garante aceitação ou indenização
          por seguradora. As declarações feitas à seguradora são de responsabilidade da empresa.
        </p>
      </div>
    </main>
  );
}
