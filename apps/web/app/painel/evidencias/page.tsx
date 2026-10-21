import { formatDateTime } from "@/lib/assessment-data";
import base12 from "@/lib/base12.json";
import { getPainel } from "@/lib/painel-data";
import { createClient } from "@/lib/supabase/server";
import { Card, LockedCard, PageHeader } from "../ui";
import { Uploader } from "./uploader";

export const metadata = { title: "Evidências — Sentinela" };

export default async function EvidenciasPage() {
  const p = await getPainel();
  const controls = base12.controles.map((c) => ({ id: c.id, name: c.nome }));
  const names = new Map(controls.map((c) => [c.id, c.name]));

  const supabase = await createClient();
  const { data: files } = p.paid
    ? await supabase
        .from("evidence")
        .select("id, control_id, file_name, size_bytes, sha256, created_at")
        .eq("org_id", p.org.id)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };

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
                          <a href={`/painel/evidencias/arquivo?id=${f.id}`} className="text-xs font-semibold text-teal-strong hover:underline">Baixar</a>
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
