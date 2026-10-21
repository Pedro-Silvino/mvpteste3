import Link from "next/link";
import { redirect } from "next/navigation";
import { currentOrgId } from "@/lib/org";
import { bandFor, countByStatus } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";
import { AutoRefresh } from "./auto-refresh";
import { DownloadButton } from "./download-button";

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
const CHIP_LABEL = { atende: "atendem", parcial: "parciais", nao_atende: "não atendem", sem_dado: "sem dado" } as const;

// First screen after the questionnaire. Free level on purpose: score and totals only. WHICH controls are
// open and HOW to fix them live in the dashboard, behind a paid plan (D19).
export default async function ResultadoPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/comecar");

  const orgId = await currentOrgId(supabase, user.id);
  if (!orgId) redirect("/comecar");
  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, org_id, status, score, external_score")
    .eq("org_id", orgId)
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
  const { data: rows } = await supabase.from("control_results").select("status").eq("assessment_id", assessment.id);
  const counts = countByStatus(rows ?? []);

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
            {(Object.keys(CHIP_LABEL) as (keyof typeof CHIP_LABEL)[]).map((s) => (
              <span key={s} className={`rounded-full px-3 py-1 ${CHIP[s]}`}>
                {counts[s]} {CHIP_LABEL[s]}
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

        <section className="rounded-3xl bg-n1 p-6 text-white shadow-lg shadow-n3/20 sm:p-9">
          <h2 className="text-2xl font-bold leading-snug">Quais são as lacunas e como resolver?</h2>
          <p className="mt-2 text-ice">
            O seu relatório e as suas respostas ficaram guardados no painel. Lá você escolhe um plano para ver as
            lacunas, uma a uma, com o passo a passo, kits de documentos e orientações.
          </p>
          <Link
            href="/painel"
            className="mt-6 inline-block rounded-xl bg-teal px-6 py-3.5 font-semibold text-white hover:bg-sky hover:text-n1"
          >
            Abrir meu painel
          </Link>
        </section>

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
