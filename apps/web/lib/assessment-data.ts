import type { SupabaseClient } from "@supabase/supabase-js";

export type ExternalScan = {
  domain: string;
  score: number | null;
  checks: Record<string, string>;
  collectedAt: string; // ISO timestamp the worker stored
};

// Latest public scan of the company (written by the worker with the service role; members can read it).
export async function latestExternalScan(supabase: SupabaseClient, orgId: string): Promise<ExternalScan | null> {
  const { data } = await supabase
    .from("scan_results")
    .select("summary, collected_at")
    .eq("org_id", orgId)
    .eq("module", "externo")
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const s = data?.summary as { domain?: string; score?: number | null; checks?: Record<string, string> } | undefined;
  if (!data || !s?.checks) return null;
  return { domain: s.domain ?? "", score: s.score ?? null, checks: s.checks, collectedAt: data.collected_at };
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
}
