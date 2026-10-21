import { redirect } from "next/navigation";
import { cache } from "react";
import { latestExternalScan } from "./assessment-data";
import { currentOrgId } from "./org";
import { isPaidPlan, type PaidPlanId } from "./plans";
import { createClient } from "./supabase/server";
import { threatExposure } from "./threats";

// Everything the dashboard pages need, loaded once per request (React cache) and always pinned to the
// signed-in user's own company. Redirects when there is no session, no company or the quiz isn't finished.
export const getPainel = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/comecar");

  const orgId = await currentOrgId(supabase, user.id);
  if (!orgId) redirect("/comecar");

  const { data: org } = await supabase.from("organizations").select("id, name, domain, plan, cnpj, sector, employees_range").eq("id", orgId).maybeSingle();
  if (!org) redirect("/comecar");

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, status, score, external_score, completed_at")
    .eq("org_id", orgId)
    .eq("kind", "express")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!assessment) redirect("/comecar");
  if (assessment.status === "rascunho") redirect("/diagnostico");

  const [{ data: report }, { data: answers }, { data: results }, { data: requests }, scan] = await Promise.all([
    supabase.from("reports").select("created_at").eq("assessment_id", assessment.id).eq("kind", "express").limit(1).maybeSingle(),
    supabase.from("answers").select("question_id, value").eq("assessment_id", assessment.id),
    supabase.from("control_results").select("control_id, status").eq("assessment_id", assessment.id),
    supabase.from("alerts").select("message").eq("org_id", orgId).is("resolved_at", null).like("message", "Pedido de proposta:%").limit(1),
    latestExternalScan(supabase, orgId),
  ]);

  const rows = results ?? [];
  return {
    user: { id: user.id, anonymous: !!user.is_anonymous },
    org,
    assessment,
    ready: assessment.status === "concluido" && assessment.score !== null && !!report,
    failed: assessment.status === "erro",
    score: assessment.score as number | null,
    savedOn: report?.created_at ?? null,
    paid: isPaidPlan(org.plan),
    profileComplete: !!org.cnpj && !!org.sector && !!org.employees_range && org.name !== org.domain,
    requestedPlan: (requests?.[0]?.message.split("plano ")[1] as PaidPlanId | undefined) ?? null,
    answers: new Map((answers ?? []).map((a) => [a.question_id, a.value])),
    rows,
    scan,
    threats: threatExposure(rows, scan?.checks),
  };
});
