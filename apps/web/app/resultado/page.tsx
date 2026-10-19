import Link from "next/link";
import { redirect } from "next/navigation";
import { bandFor, STATUS_LABEL, topGaps } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";
import { AutoRefresh } from "./auto-refresh";

export const metadata = { title: "Resultado — Sentinela" };

const card = "rounded-3xl bg-white p-6 shadow-lg shadow-n3/10 sm:p-9";

export default async function ResultadoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/comecar");

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, status, score, external_score")
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
        <AutoRefresh />
        <div className={`${card} w-full max-w-xl text-center`}>
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-ice border-t-teal" />
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
  const { data: rows } = await supabase
    .from("control_results")
    .select("control_id, status")
    .eq("assessment_id", assessment.id);
  const gaps = topGaps(rows ?? []);

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
            A nota resume quantos dos 12 controles mínimos de segurança a empresa declarou ter. Controles mais
            importantes valem mais.
          </p>
          <a
            href="/resultado/pdf"
            className="mt-6 inline-block rounded-xl bg-teal px-6 py-3.5 font-semibold text-white hover:bg-n3"
          >
            Baixar relatório em PDF
          </a>
        </section>

        {gaps.length > 0 && (
          <section className={card}>
            <h2 className="text-xl font-bold text-n1">Por onde começar</h2>
            <p className="mt-1 text-sm text-muted">As 3 maiores lacunas encontradas.</p>
            <div className="mt-5 space-y-4">
              {gaps.map((g) => (
                <div key={g.id} className="rounded-2xl border border-line border-l-4 border-l-teal p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-n1">{g.name}</h3>
                    <span className="shrink-0 rounded-full bg-ice px-3 py-0.5 text-xs font-semibold text-n3">
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
        )}

        {user.is_anonymous && (
          <section className={`${card} text-center`}>
            <h2 className="text-xl font-bold text-n1">Guarde o seu diagnóstico</h2>
            <p className="mt-1 text-sm text-muted">Crie e-mail e senha para voltar a este resultado quando quiser.</p>
            <Link
              href="/conta"
              className="mt-4 inline-block rounded-xl border-2 border-teal px-6 py-3 font-semibold text-teal hover:bg-ice"
            >
              Salvar meu diagnóstico
            </Link>
          </section>
        )}

        <p className="px-2 text-center text-xs text-muted">
          Retrato do ambiente na data da coleta. Não substitui análise jurídica nem garante aceitação ou indenização
          por seguradora. As declarações feitas à seguradora são de responsabilidade da empresa.
        </p>
      </div>
    </main>
  );
}
