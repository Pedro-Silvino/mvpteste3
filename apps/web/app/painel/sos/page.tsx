import Link from "next/link";
import { formatDateTime } from "@/lib/assessment-data";
import { getPainel } from "@/lib/painel-data";
import { createClient } from "@/lib/supabase/server";
import { FIRST_STEPS } from "@/lib/validation/incident";
import { Card, PageHeader } from "../ui";
import { SosForm } from "./sos-form";

export const metadata = { title: "SOS — Sentinela" };

const STATUS: Record<string, string> = { aberto: "Aberto", em_atendimento: "Em atendimento", encerrado: "Encerrado" };

export default async function SosPage() {
  const p = await getPainel();
  const supabase = await createClient();
  const [{ data: incidents }, { data: plan }] = await Promise.all([
    supabase.from("incidents").select("id, description, status, created_at").eq("org_id", p.org.id).order("created_at", { ascending: false }).limit(10),
    supabase
      .from("documents")
      .select("id, version, approved_at")
      .eq("org_id", p.org.id)
      .eq("kind", "plano_incidente")
      .not("approved_at", "is", null)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader title="SOS" subtitle="Aconteceu algo grave? Abra um chamado: ele aparece na hora para a equipe DataDops." />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="border-red-200">
          <h2 className="text-lg font-bold text-n1">Abrir chamado</h2>
          {p.user.anonymous && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              A sua conta ainda não tem e-mail, então a equipe não tem como responder.{" "}
              <a href="/conta" className="font-semibold underline">
                Salve a conta com e-mail e senha
              </a>{" "}
              e depois abra o chamado.
            </p>
          )}
          <div className="mt-4">
            <SosForm orgId={p.org.id} />
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-n1">Primeiros passos</h2>
          <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-ink">
            {FIRST_STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <div className="mt-5 rounded-xl bg-ice/60 p-4 text-sm">
            {plan ? (
              <>
                <b className="text-n1">Seu plano de incidente aprovado</b> (versão {plan.version}) está em{" "}
                <Link href={`/painel/documentos/arquivo?id=${plan.id}`} className="font-semibold text-teal-strong underline">
                  baixar o PDF
                </Link>
                .
              </>
            ) : (
              <>
                Sua empresa ainda não tem um plano de incidente aprovado.{" "}
                <Link href="/painel/documentos" className="font-semibold text-teal-strong underline">
                  Veja em Documentos
                </Link>
                .
              </>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-bold text-n1">Chamados anteriores</h2>
        {(incidents ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nenhum chamado aberto.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {(incidents ?? []).map((i) => (
              <li key={i.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-n1">{i.description}</p>
                  <p className="text-xs text-muted">{formatDateTime(i.created_at)}</p>
                </div>
                <span className="rounded-full bg-ice px-3 py-0.5 text-xs font-semibold text-n3">{STATUS[i.status] ?? i.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
