"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PAID_PLANS } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ orgId: z.uuid(), plan: z.enum(PAID_PLANS) });

// "I want this plan": becomes an alert for the DataDops team (see request_plan). The team activates the plan.
export async function requestPlan(orgId: string, plan: string): Promise<{ ok: boolean; needsAccount?: boolean }> {
  const parsed = schema.safeParse({ orgId, plan });
  if (!parsed.success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_plan", { p_org: parsed.data.orgId, p_plan: parsed.data.plan });
  if (error) {
    console.error("request_plan failed", { code: error.code, message: error.message });
    return { ok: false, needsAccount: error.message.includes("account_required") };
  }
  revalidatePath("/painel");
  return { ok: true };
}
