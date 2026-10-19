import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Resultado — Sentinela" };

// Placeholder until T06/T07 (score + PDF): shows where the assessment is.
export default async function ResultadoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/comecar");

  const { data: assessment } = await supabase
    .from("assessments")
    .select("status, score")
    .eq("kind", "express")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!assessment) redirect("/comecar");
  if (assessment.status === "rascunho") redirect("/diagnostico");

  return (
    <main className="flex flex-1 items-center justify-center bg-ice px-4 py-12">
      <div className="w-full max-w-xl rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
        {assessment.status === "concluido" ? (
          <>
            <h1 className="text-2xl font-bold text-n1">Nota de maturidade: {assessment.score}</h1>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-n1">Respostas recebidas</h1>
            <p className="mt-2 text-muted">Estamos montando a sua nota e o relatório. Volte a esta página em instantes.</p>
          </>
        )}
        {user.is_anonymous && (
          <Link
            href="/conta"
            className="mt-6 inline-block rounded-lg bg-teal px-5 py-3 font-semibold text-white hover:bg-n3"
          >
            Salvar meu diagnóstico (e-mail e senha)
          </Link>
        )}
      </div>
    </main>
  );
}
