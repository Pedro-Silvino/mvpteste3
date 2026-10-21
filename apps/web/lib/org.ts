import type { SupabaseClient } from "@supabase/supabase-js";

// The signed-in user's own (most recent) company. RLS also lets staff read every company, so "latest row"
// queries must always be pinned to this id instead of relying on RLS to scope them.
export async function currentOrgId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.org_id ?? null;
}
