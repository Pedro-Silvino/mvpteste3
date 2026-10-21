import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { formatDateTime } from "@/lib/assessment-data";
import { PLANS } from "@/lib/plans";
import base12 from "@/lib/base12.json";
import { buildSteps } from "@/lib/questionnaire";
import { STATUS_LABEL } from "@/lib/result";
import { requireStaff } from "@/lib/staff";
import { Card, CHIP, PageHeader } from "../../../painel/ui";
import { resolveAlert, reviewControl, setPlan } from "../../actions";

const field = "field mt-0 px-3 py-2 text-sm";

export default async function StaffOrgPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await requireStaff();

  const { data: org } = await supabase.from("organizations").select("*").eq("id", id).maybeSingle();
  if (!org) notFound();

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, status, score, external_score, seal, created_at")
    .eq("org_id", id)
    .eq("kind", "express")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [{ data: results }, { data: answers }, { data: alerts }, { data: incidents }, { data: evidence }, { data: documents }, { data: tokens }] =
    await Promise.all([
      assessment ? supabase.from("control_results").select("control_id, status, source, note").eq("assessment_id", assessment.id) : Promise.resolve({ data: [] }),
      assessment ? supabase.from("answers").select("question_id, value").eq("assessment_id", assessment.id) : Promise.resolve({ data: [] }),
      supabase.from("alerts").select("id, severity, message, created_at").eq("org_id", id).is("resolved_at", null),
      supabase.from("incidents").select("id, description, status, created_at").eq("org_id", id).order("created_at", { ascending: false }).limit(5),
      supabase.from("evidence").select("control_id, file_name, sha256, created_at").eq("org_id", id).order("created_at", { ascending: false }).limit(20),
      supabase.from("documents").select("kind, version, approved_at, created_at").eq("org_id", id).order("created_at", { ascending: false }).limit(10),
      supabase.from("agent_tokens").select("label, last_used_at, revoked_at").eq("org_id", id),
    ]);

  const answerMap = new Map((answers ?? []).map((a) => [a.question_id, a.value]));
  const steps = buildSteps();
  const controls = new Map(base12.controles.map((c) => [c.id, c]));

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/staff" className="font-semibold text-teal-strong hover:underline">← Voltar</Link>
      </p>
      <PageHeader title={org.domain ?? org.name} subtitle={`${org.name} · cadastrada em ${formatDateTime(org.created_at)}`} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="text-lg font-bold text-n1">Cadastro</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted">CNPJ</dt><dd>{org.cnpj ?? "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Setor</dt><dd>{org.sector ?? "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Funcionários</dt><dd>{org.employees_range ?? "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Nota</dt><dd>{assessment?.score ?? "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Nota externa</dt><dd>{assessment?.external_score ?? "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Selo</dt><dd>{assessment?.seal ?? "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Agentes</dt><dd>{(tokens ?? []).filter((t) => !t.revoked_at).length} ativo(s)</dd></div>
          </dl>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-n1">Plano</h2>
          <form action={setPlan} className="mt-3 space-y-3">
            <input type="hidden" name="orgId" value={org.id} />
            <select name="plan" aria-label="Plano da empresa" defaultValue={org.plan} className={`${field} w-full`}>
              {PLANS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button className="btn-primary w-full">Ativar plano</button>
            <p className="text-xs text-muted">Resolve o pedido de proposta aberto e registra na auditoria.</p>
          </form>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-n1">Alertas abertos</h2>
          {(alerts ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nenhum.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {(alerts ?? []).map((a) => (
                <li key={a.id} className="text-sm">
                  <p className="text-n1">{a.message}</p>
                  <form action={resolveAlert} className="mt-1">
                    <input type="hidden" name="alertId" value={a.id} />
                    <button className="text-xs font-semibold text-teal-strong hover:underline">Marcar como resolvido</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {assessment && (
        <Card className="mt-4">
          <h2 className="text-lg font-bold text-n1">Controles e revisão</h2>
          <p className="mt-1 text-sm text-muted">Mudar a situação grava a fonte como revisão e fica na auditoria.</p>
          <div className="mt-4 divide-y divide-line">
            {(results ?? []).map((r) => {
              const c = controls.get(r.control_id);
              return (
                <form key={r.control_id} action={reviewControl} className="flex flex-wrap items-center gap-3 py-3">
                  <input type="hidden" name="assessmentId" value={assessment.id} />
                  <input type="hidden" name="orgId" value={org.id} />
                  <input type="hidden" name="controlId" value={r.control_id} />
                  <div className="min-w-[14rem] flex-1">
                    <p className="text-sm font-semibold text-n1">{r.control_id} · {c?.nome}</p>
                    <p className="text-xs text-muted">
                      Resposta: {steps.find((s) => s.id === r.control_id)?.options.find((o) => o.value === answerMap.get(r.control_id))?.label ?? "—"} · fonte: {r.source}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CHIP[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  <select name="status" aria-label={`Situação de ${r.control_id}`} defaultValue={r.status} className={`${field} w-auto`}>
                    {Object.entries(STATUS_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                  <input name="note" aria-label={`Observação sobre ${r.control_id}`} defaultValue={r.note ?? ""} maxLength={500} placeholder="Observação" className={`${field} w-48`} />
                  <button className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-n3 hover:bg-ice">Salvar</button>
                </form>
              );
            })}
          </div>
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="text-lg font-bold text-n1">Incidentes (SOS)</h2>
          {(incidents ?? []).length === 0 ? <p className="mt-3 text-sm text-muted">Nenhum.</p> : (
            <ul className="mt-3 space-y-3 text-sm">
              {(incidents ?? []).map((i) => (
                <li key={i.id}>
                  <p className="text-n1">{i.description}</p>
                  <p className="text-xs text-muted">{i.status} · {formatDateTime(i.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="text-lg font-bold text-n1">Evidências</h2>
          {(evidence ?? []).length === 0 ? <p className="mt-3 text-sm text-muted">Nenhuma.</p> : (
            <ul className="mt-3 space-y-2 text-sm">
              {(evidence ?? []).map((e) => (
                <li key={e.sha256 + e.control_id}>
                  <p className="text-n1">{e.control_id} · {e.file_name}</p>
                  <p className="font-mono text-xs text-muted">{e.sha256.slice(0, 16)}…</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="text-lg font-bold text-n1">Documentos</h2>
          {(documents ?? []).length === 0 ? <p className="mt-3 text-sm text-muted">Nenhum.</p> : (
            <ul className="mt-3 space-y-2 text-sm">
              {(documents ?? []).map((d) => (
                <li key={d.kind + d.version} className="flex justify-between gap-2">
                  <span className="text-n1">{d.kind} v{d.version}</span>
                  <span className="text-xs text-muted">{d.approved_at ? "aprovado" : "aguardando aprovação"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
