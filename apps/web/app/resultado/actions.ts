"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// "I want the tutorials / to hire": becomes an alert for the DataDops team (see request_plan).
export async function requestPlan(orgId: string): Promise<{ ok: boolean; needsAccount?: boolean }> {
  if (!z.uuid().safeParse(orgId).success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_plan", { p_org: orgId });
  if (error) {
    console.error("request_plan failed", { code: error.code, message: error.message });
    return { ok: false, needsAccount: error.message.includes("account_required") };
  }
  revalidatePath("/resultado");
  return { ok: true };
}
