import { formatDateTime } from "@/lib/assessment-data";
import { AGENT_SHA256, AGENT_VERSION } from "@/lib/agent-info";
import { getPainel } from "@/lib/painel-data";
import { createClient } from "@/lib/supabase/server";
import { Card, LockedCard, PageHeader } from "../ui";
import { revokeToken } from "./actions";
import { TokenForm } from "./token-form";

export const metadata = { title: "Coletor — Sentinela" };

export default async function AgentePage() {
  const p = await getPainel();
  if (!p.paid) {
    return (
      <div className="space-y-5">
        <PageHeader title="Coletor dos computadores" subtitle="Confere antivírus, atualizações e criptografia de cada computador, sem pedir senha de ninguém." />
        <LockedCard
          title="Deixe o Sentinela conferir os computadores"
          text="Com o coletor, o diagnóstico passa a mostrar o que foi realmente verificado, e não só o que foi respondido. Liberado em qualquer plano pago."
        />
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: tokens }, { data: reports }] = await Promise.all([
    supabase.from("agent_tokens").select("id, label, created_at, expires_at, revoked_at, last_used_at").eq("org_id", p.org.id).order("created_at", { ascending: false }),
    supabase.from("scan_results").select("device_ref, received_at, module").eq("org_id", p.org.id).in("module", ["windows", "m365"]).order("received_at", { ascending: false }).limit(500),
  ]);
  const devices = new Map<string, string>();
  for (const r of reports ?? []) if (r.module === "windows" && r.device_ref && !devices.has(r.device_ref)) devices.set(r.device_ref, r.received_at);
  const workerUrl = process.env.WORKER_PUBLIC_URL?.replace(/\/$/, "") ?? "";
  const ingestUrl = workerUrl ? `${workerUrl}/ingest` : "https://ENDERECO-DO-WORKER/ingest";
  const active = (tokens ?? []).filter((t) => !t.revoked_at && new Date(t.expires_at) > new Date());

  return (
    <div className="space-y-5">
      <PageHeader
        title="Coletor dos computadores"
        subtitle="Programa que a TI roda em cada computador. Ele envia só um resumo (sim ou não e contagens), sem nomes, senhas nem arquivos."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="text-lg font-bold text-n1">1. Gerar um token</h2>
          <p className="mb-4 mt-1 text-sm text-muted">O token autoriza o envio do resumo. Um token serve para vários computadores.</p>
          <TokenForm orgId={p.org.id} ingestUrl={ingestUrl} />
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-n1">Máquinas que já enviaram</h2>
          <p className="mt-2 font-display text-4xl font-extrabold text-n1">{devices.size}</p>
          <p className="mt-1 text-xs text-muted">
            {devices.size ? `Último envio em ${formatDateTime([...devices.values()].sort().at(-1)!)}.` : "Nenhum envio ainda."}
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-bold text-n1">2. Baixar o coletor</h2>
        <p className="mt-1 text-sm text-muted">Versão {AGENT_VERSION}. Confira o código de verificação antes de rodar.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <a href="/downloads/sentinela-agent.ps1" download className="btn-dark">
            Baixar sentinela-agent.ps1
          </a>
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">SHA-256 do arquivo</p>
        <p className="mt-1 break-all rounded-lg bg-ice/60 p-3 font-mono text-xs text-n1">{AGENT_SHA256}</p>
        <p className="mt-2 text-xs text-muted">
          Para conferir, no PowerShell: <code className="rounded bg-ice/60 px-1.5 py-0.5">Get-FileHash .\sentinela-agent.ps1 -Algorithm SHA256</code>
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-bold text-n1">3. Rodar em cada computador</h2>
        <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-ink">
          <li>
            Teste primeiro (não envia nada):
            <pre className="mt-1 overflow-x-auto rounded-lg bg-n1 p-3 text-xs text-ice">powershell -ExecutionPolicy Bypass -File .\sentinela-agent.ps1 -DryRun</pre>
          </li>
          <li>Envie de verdade com o comando que aparece ao gerar o token.</li>
          <li>Para ler o BitLocker, abra o PowerShell como administrador. Sem isso, esse item vai como “não informado”.</li>
          <li>O relatório completo de cada máquina fica na pasta Documentos\Sentinela do próprio computador.</li>
        </ol>
      </Card>

      <Card>
        <h2 className="text-lg font-bold text-n1">Tokens ({active.length} ativos)</h2>
        {(tokens ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nenhum token gerado.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 pr-3">Nome</th>
                  <th className="py-2 pr-3">Criado</th>
                  <th className="py-2 pr-3">Último uso</th>
                  <th className="py-2 pr-3">Situação</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(tokens ?? []).map((t) => {
                  const expired = new Date(t.expires_at) <= new Date();
                  const state = t.revoked_at ? "Revogado" : expired ? "Expirado" : "Ativo";
                  return (
                    <tr key={t.id}>
                      <td className="py-3 pr-3 font-semibold text-n1">{t.label}</td>
                      <td className="py-3 pr-3 text-muted">{formatDateTime(t.created_at)}</td>
                      <td className="py-3 pr-3 text-muted">{t.last_used_at ? formatDateTime(t.last_used_at) : "—"}</td>
                      <td className="py-3 pr-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${state === "Ativo" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>{state}</span>
                      </td>
                      <td className="py-3 text-right">
                        {state === "Ativo" && (
                          <form action={revokeToken}>
                            <input type="hidden" name="tokenId" value={t.id} />
                            <button className="text-xs font-semibold text-red-700 hover:underline">Revogar</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
