import { redirect } from "next/navigation";
import { buildSteps } from "@/lib/questionnaire";
import { createClient } from "@/lib/supabase/server";
import { Questionnaire } from "./questionnaire";

export const metadata = { title: "Diagnóstico — Sentinela" };

export default async function DiagnosticoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/comecar");

  // RLS limits this to the user's own organizations.
  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, status")
    .eq("kind", "express")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!assessment) redirect("/comecar");
  if (assessment.status !== "rascunho") redirect("/resultado");

  const { data: rows } = await supabase
    .from("answers")
    .select("question_id, value")
    .eq("assessment_id", assessment.id);
  const initialAnswers = Object.fromEntries((rows ?? []).map((r) => [r.question_id, r.value]));

  return (
    <main className="flex flex-1 items-center justify-center bg-ice px-4 py-8">
      <Questionnaire assessmentId={assessment.id} steps={buildSteps()} initialAnswers={initialAnswers} />
    </main>
  );
}
