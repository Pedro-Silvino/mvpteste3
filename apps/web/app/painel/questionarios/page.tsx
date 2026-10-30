import type { SupabaseClient } from "@supabase/supabase-js";
import { getPainel } from "@/lib/painel-data";
import type { VaultItem } from "@/lib/questionnaire-matcher";
import { createClient } from "@/lib/supabase/server";
import { canUseVault } from "@/lib/vault";
import { LockedCard, PageHeader } from "../ui";
import { QuestionnaireTool } from "./tool";

export const metadata = { title: "Questionários — Sentinela" };

export default async function QuestionariosPage() {
  const p = await getPainel();
  const allowed = canUseVault(p.org.plan);
  let vault: VaultItem[] = [];
  if (allowed) {
    const supabase = (await createClient()) as unknown as SupabaseClient;
    const { data } = await supabase
      .from("evidence_vault")
      .select("id, title, category, file_hash_sha256, created_at")
      .eq("organization_id", p.org.id)
      .order("created_at", { ascending: false })
      .limit(200);
    vault = (data ?? []) as VaultItem[];
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Questionários de clientes e seguradoras"
        subtitle="Cole as perguntas (JSON ou CSV). O Sentinela sugere a resposta com base nas evidências do cofre, mostra qual evidência usou e você aprova cada uma com um clique."
      />
      {!allowed ? (
        <LockedCard title="Responda questionários com as suas provas" text="A resposta assistida usa o cofre de evidências, que faz parte dos planos com cofre. Fale com a DataDops para uma proposta sob medida." />
      ) : (
        <QuestionnaireTool vault={vault} />
      )}
    </div>
  );
}
