import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Card, CHIP, PageHeader } from "@/app/painel/ui";
import { formatDateTime } from "@/lib/assessment-data";
import { parseDetail } from "@/lib/partner-data";
import { requirePartner } from "@/lib/partner-session";
import base12 from "@/lib/base12.json";
import { bandFor, STATUS_LABEL } from "@/lib/result";
import { controlName, ESSENTIAL_CONTROLS, evaluateReadiness, LEVEL_CHIP, LEVEL_LABEL, REASON_LABEL, type ControlStatus } from "@/lib/readiness";

export const metadata = { title: "Cliente — Sentinela" };

export default async function CorretorClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await requirePartner();

  // The database refuses (and writes nothing) when the client did not authorize sharing or is not this broker's.
  const { data, error } = await supabase.rpc("partner_client_detail", { p_org: id });
  if (error || !data) notFound();
  const d = parseDetail(data);

  const readiness = evaluateReadiness(d.controls as Record<string, ControlStatus>, d.evidence.map((e) => e.control_id));
  const proofs = new Map<string, number>();
  for (const e of d.evidence) proofs.set(e.control_id, (proofs.get(e.control_id) ?? 0) + 1);
  const essential = new Set<string>(ESSENTIAL_CONTROLS);
  const band = d.score !== null ? bandFor(d.score) : null;

  return (
    <div className="space-y-5">
      <p className="text-sm">
        <Link href="/corretor" className="link">
          ← Voltar para os clientes
        </Link>
      </p>
      <PageHeader title={d.domain ?? d.name} subtitle={`${d.sector ?? "Setor não informado"} · ${d.employees_range ?? "porte não informado"} funcionários · entrou em ${formatDateTime(d.created_at)}`} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold text-n1">Prontidão para o questionário da seguradora</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${LEVEL_CHIP[readiness.level]}`}>{LEVEL_LABEL[readiness.level]}</span>
          </div>
          <p className="mt-2 text-sm text-muted">
            {readiness.essentialsMet} de {readiness.essentialsTotal} controles essenciais em dia e {readiness.essentialsWithEvidence} de {readiness.essentialsTotal} com prova guardada.
            É uma leitura do diagnóstico e das provas enviadas; não garante aceitação pela seguradora.
          </p>
          {readiness.pending.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm">
              {readiness.pending.map((p) => (
                <li key={p.control} className="flex flex-wrap items-baseline gap-2">
                  <span className="font-semibold text-n1">
                    {p.control} · {controlName(p.control)}
                  </span>
                  <span className="text-muted">{REASON_LABEL[p.reason]}</span>
                </li>
              ))}
            </ul>
          ) : readiness.level === "pronta" ? (
            <p className="mt-4 text-sm text-green-800">Todos os controles essenciais estão em dia e com prova guardada.</p>
          ) : null}
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Nota de maturidade</p>
          <p className="mt-2 font-display text-4xl font-extrabold text-n1">
            {d.score ?? "—"}
            {d.score !== null && <span className="ml-1 text-base font-semibold text-muted">/100</span>}
          </p>
          {band && (
            <span className="mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: band.color }}>
              {band.label}
            </span>
          )}
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted">Checagem pública</dt><dd>{d.external_score ?? "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Computadores verificados</dt><dd>{d.collector_devices}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Plano</dt><dd>{d.plan === "express" ? "Grátis" : d.plan}</dd></div>
          </dl>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-bold text-n1">Os 12 controles</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="py-2 pr-3">Controle</th>
                <th className="py-2 pr-3">Situação</th>
                <th className="py-2">Provas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {base12.controles.map((c) => {
                const st = d.controls[c.id];
                return (
                  <tr key={c.id}>
                    <td className="py-3 pr-3">
                      <span className="font-semibold text-n1">{c.id} · {c.nome}</span>
                      {essential.has(c.id) && <span className="ml-2 rounded-full bg-ice px-2 py-0.5 text-xs font-semibold text-n3">Essencial para o seguro</span>}
                    </td>
                    <td className="py-3 pr-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CHIP[st ?? "sem_dado"]}`}>{STATUS_LABEL[st ?? "sem_dado"]}</span>
                    </td>
                    <td className="py-3">{proofs.get(c.id) ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-bold text-n1">Provas guardadas ({d.evidence.length})</h2>
        <p className="mt-1 text-sm text-muted">Nome do arquivo, data e código de verificação (SHA-256). O arquivo em si fica com a empresa.</p>
        {d.evidence.length === 0 ? (
          <p className="mt-3 text-sm text-muted">O cliente ainda não enviou nenhuma prova.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line text-sm">
            {d.evidence.map((e) => (
              <li key={`${e.control_id}-${e.sha256}-${e.created_at}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <b className="text-n1">{e.control_id}</b> · {e.file_name}
                </span>
                <span className="text-xs text-muted">
                  {formatDateTime(e.created_at)} · <span className="font-mono">{e.sha256}…</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
