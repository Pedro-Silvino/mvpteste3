import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDateTime } from "@/lib/assessment-data";
import { getPainel } from "@/lib/painel-data";
import { createClient } from "@/lib/supabase/server";
import { canUseVault, VAULT_CATEGORY_LABEL, type VaultCategory } from "@/lib/vault";
import { Card, LockedCard, PageHeader } from "../ui";
import { VaultUploader } from "./uploader";

export const metadata = { title: "Cofre de evidências — Sentinela" };

type Row = { id: string; title: string; category: VaultCategory; file_hash_sha256: string; created_at: string };

export default async function CofrePage() {
  const p = await getPainel();
  const allowed = canUseVault(p.org.plan);
  let items: Row[] = [];
  if (allowed) {
    const supabase = (await createClient()) as unknown as SupabaseClient;
    const { data } = await supabase
      .from("evidence_vault")
      .select("id, title, category, file_hash_sha256, created_at")
      .eq("organization_id", p.org.id)
      .order("created_at", { ascending: false })
      .limit(200);
    items = (data ?? []) as Row[];
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cofre de evidências"
        subtitle="Provas guardadas com data e código de verificação (SHA-256). Depois de guardadas, não podem ser alteradas nem apagadas, o que dá confiança a quem recebe o questionário."
      />
      {!allowed ? (
        <LockedCard
          title="Guarde as provas num cofre que não se altera"
          text="O cofre e a resposta assistida de questionários fazem parte dos planos com cofre. Fale com a DataDops para uma proposta sob medida."
        />
      ) : (
        <>
          <Card className="max-w-2xl">
            <h2 className="mb-4 text-lg font-bold text-n1">Guardar evidência</h2>
            <VaultUploader orgId={p.org.id} />
          </Card>
          <Card>
            <h2 className="text-lg font-bold text-n1">Evidências guardadas ({items.length})</h2>
            {items.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nenhuma evidência ainda.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="py-2 pr-3">Evidência</th>
                      <th className="py-2 pr-3">Tipo</th>
                      <th className="py-2 pr-3">Guardada em</th>
                      <th className="py-2">SHA-256</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {items.map((i) => (
                      <tr key={i.id}>
                        <td className="py-2 pr-3 font-medium text-n1">{i.title}</td>
                        <td className="py-2 pr-3">{VAULT_CATEGORY_LABEL[i.category] ?? i.category}</td>
                        <td className="py-2 pr-3">{formatDateTime(i.created_at)}</td>
                        <td className="py-2 font-mono text-xs" title={i.file_hash_sha256}>{i.file_hash_sha256.slice(0, 16)}…</td>
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
