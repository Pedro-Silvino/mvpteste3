import { redirect } from "next/navigation";
import { cache } from "react";
import { latestExternalScan } from "./assessment-data";
import { currentOrgId } from "./org";
import { isPaidPlan, type PaidPlanId } from "./plans";
import { evaluateReadiness, type ControlStatus } from "./readiness";
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

  const { data: org } = await supabase.from("organizations").select("id, name, domain, plan, cnpj, sector, employees_range, partner_id").eq("id", orgId).maybeSingle();
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

  // Collector data produces a "completo" assessment (answers + what the collector saw). When there is one, it is what the panel shows.
  const { data: completo } = await supabase
    .from("assessments")
    .select("id, score")
    .eq("org_id", orgId)
    .eq("kind", "completo")
    .eq("status", "concluido")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const shownId = completo?.id ?? assessment.id;

  const [{ data: report }, { data: answers }, { data: results }, { data: requests }, scan, { data: alerts }, { data: history }, { data: evidence }, { data: partnerStatus }] = await Promise.all([
    supabase.from("reports").select("created_at").eq("assessment_id", assessment.id).eq("kind", "express").limit(1).maybeSingle(),
    supabase.from("answers").select("question_id, value").eq("assessment_id", assessment.id),
    supabase.from("control_results").select("control_id, status, source, divergence").eq("assessment_id", shownId),
    supabase.from("alerts").select("message").eq("org_id", orgId).is("resolved_at", null).like("message", "Pedido de proposta:%").limit(1),
    latestExternalScan(supabase, orgId),
    supabase
      .from("alerts")
      .select("id, severity, message, created_at")
      .eq("org_id", orgId)
      .is("resolved_at", null)
      .not("message", "like", "Pedido de proposta:%")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("reports").select("id, kind, storage_path, created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(36),
    supabase.from("evidence").select("control_id").eq("org_id", orgId).limit(500),
    // Who referred this company and whether it authorized sharing (null = no broker).
    org.partner_id ? supabase.rpc("org_partner_status", { p_org: orgId }) : Promise.resolve({ data: null }),
  ]);

  const rows = results ?? [];
  const partner = partnerStatus as { name: string; shared: boolean } | null;
  const evidenceControls = [...new Set((evidence ?? []).map((e) => e.control_id))];
  const readiness = evaluateReadiness(
    Object.fromEntries(rows.map((r) => [r.control_id, r.status as ControlStatus])),
    evidenceControls,
  );
  return {
    user: { id: user.id, anonymous: !!user.is_anonymous },
    org,
    assessment,
    ready: assessment.status === "concluido" && assessment.score !== null && !!report,
    failed: assessment.status === "erro",
    score: (completo?.score ?? assessment.score) as number | null,
    fromCollector: !!completo,
    savedOn: report?.created_at ?? null,
    paid: isPaidPlan(org.plan),
    // Evidence is open to paid plans and to companies referred by a broker (see org_can_collect_evidence).
    canCollectEvidence: isPaidPlan(org.plan) || !!org.partner_id,
    partner,
    evidenceControls,
    readiness,
    profileComplete: !!org.cnpj && !!org.sector && !!org.employees_range && org.name !== org.domain,
    requestedPlan: (requests?.[0]?.message.split("plano ")[1] as PaidPlanId | undefined) ?? null,
    answers: new Map((answers ?? []).map((a) => [a.question_id, a.value])),
    rows,
    scan,
    alerts: alerts ?? [],
    history: history ?? [],
    threats: threatExposure(rows, scan?.checks),
  };
});
