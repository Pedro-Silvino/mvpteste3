import { formatDateTime } from "@/lib/assessment-data";
import base12 from "@/lib/base12.json";
import { getPainel } from "@/lib/painel-data";
import { createClient } from "@/lib/supabase/server";
import { AutoRefresh } from "../../resultado/auto-refresh";
import { Card, LockedCard, PageHeader } from "../ui";
import { Uploader } from "./uploader";

export const metadata = { title: "Evidências — Sentinela" };

export default async function EvidenciasPage() {
  const p = await getPainel();
  const controls = base12.controles.map((c) => ({ id: c.id, name: c.nome }));
  const names = new Map(controls.map((c) => [c.id, c.name]));

  const supabase = await createClient();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [{ data: files }, { data: checks }] = p.paid
    ? await Promise.all([
        supabase
          .from("evidence")
          .select("id, control_id, file_name, size_bytes, sha256, created_at")
          .eq("org_id", p.org.id)
          .order("created_at", { ascending: false })
          .limit(100),
        // Files the worker is still checking, and the ones it refused in the last 24 h.
        supabase
          .from("jobs")
          .select("id, status, payload, created_at")
          .eq("org_id", p.org.id)
          .eq("kind", "evidencia")
          .or(`status.in.(pendente,rodando),and(status.eq.erro,created_at.gte.${since})`)
          .order("created_at", { ascending: false })
          .limit(20),
      ])
    : [{ data: [] }, { data: [] }];
  const pending = (checks ?? []).filter((c) => c.status !== "erro");
  const refused = (checks ?? []).filter((c) => c.status === "erro");
  const fileName = (payload: unknown) => String((payload as { file_name?: string } | null)?.file_name ?? "arquivo");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Evidências"
        subtitle="Guarde a prova de cada controle (um print do backup, o relatório do antivírus) com data e código de verificação. Isso ajuda a responder questionários de seguradoras e de clientes."
      />

      {!p.paid ? (
        <LockedCard
          title="Guarde as provas dos seus controles"
          text="Envie prints e arquivos que comprovam cada controle, com data e código SHA-256 de cada arquivo. Liberado em qualquer plano pago."
        />
      ) : (
        <>
          <Card className="max-w-2xl">
            <h2 className="mb-4 text-lg font-bold text-n1">Enviar arquivo</h2>
            <Uploader orgId={p.org.id} controls={controls} />
          </Card>

          {pending.length > 0 && <AutoRefresh everyMs={3000} />}
          {(pending.length > 0 || refused.length > 0) && (
            <Card>
              <h2 className="text-lg font-bold text-n1">Verificação dos envios</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {pending.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-ice px-2.5 py-0.5 text-xs font-semibold text-n3">Em verificação</span>
                    {fileName(c.payload)}
                  </li>
                ))}
                {refused.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">Recusado</span>
                    {fileName(c.payload)}
                    <span className="text-xs text-muted">O arquivo não é um PDF, PNG ou JPG válido de até 10 MB. Envie de novo.</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <h2 className="text-lg font-bold text-n1">Arquivos guardados ({files?.length ?? 0})</h2>
            {(files ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nenhum arquivo ainda.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="py-2 pr-3">Controle</th>
                      <th className="py-2 pr-3">Arquivo</th>
                      <th className="py-2 pr-3">Enviado em</th>
                      <th className="py-2 pr-3">SHA-256</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(files ?? []).map((f) => (
                      <tr key={f.id}>
                        <td className="py-3 pr-3">
                          <b className="text-n1">{f.control_id}</b>
                          <p className="text-xs text-muted">{names.get(f.control_id)}</p>
                        </td>
                        <td className="py-3 pr-3">
                          {f.file_name}
                          <p className="text-xs text-muted">{(f.size_bytes / 1024).toFixed(0)} KB</p>
                        </td>
                        <td className="py-3 pr-3 text-muted">{formatDateTime(f.created_at)}</td>
                        <td className="py-3 pr-3 font-mono text-xs text-muted" title={f.sha256}>{f.sha256.slice(0, 12)}…</td>
                        <td className="py-3 text-right">
                          <a href={`/painel/evidencias/arquivo?id=${f.id}`} aria-label={`Baixar ${f.file_name}`} className="text-xs font-semibold text-teal-strong hover:underline">Baixar</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
