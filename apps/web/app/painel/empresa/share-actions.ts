"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const orgSchema = z.object({ orgId: z.uuid() });

async function setShare(formData: FormData, fn: "grant_partner_share" | "revoke_partner_share") {
  const parsed = orgSchema.safeParse({ orgId: formData.get("orgId") });
  if (!parsed.success) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, { p_org: parsed.data.orgId });
  if (error) console.error(`${fn} failed`, { code: error.code, message: error.message });
  revalidatePath("/painel", "layout");
}

export async function grantShare(formData: FormData) {
  await setShare(formData, "grant_partner_share");
}

export async function revokeShare(formData: FormData) {
  await setShare(formData, "revoke_partner_share");
}
