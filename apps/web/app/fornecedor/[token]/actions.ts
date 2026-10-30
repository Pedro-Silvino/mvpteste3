"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isComplete, isVendorToken, vendorAnswersSchema } from "@/lib/vendor";

export type SubmitResult = { ok: true } | { ok: false; error: string };

// The vendor has no account: the token itself is the credential, checked by the database function
// (vendor_submit_assessment), which also accepts it only once and only before it expires.
export async function submitVendorAssessment(token: string, answers: unknown): Promise<SubmitResult> {
  if (!isVendorToken(token)) return { ok: false, error: "Este link não é válido." };
  const parsed = vendorAnswersSchema.safeParse(answers);
  if (!parsed.success || !isComplete(parsed.data)) return { ok: false, error: "Responda todas as perguntas antes de enviar." };

  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { error } = await supabase.rpc("vendor_submit_assessment", { p_token: token, p_answers: parsed.data });
  if (error) {
    console.error("vendor_submit_assessment failed", { message: error.message });
    return { ok: false, error: "Este link expirou ou já foi usado. Peça um novo à empresa que enviou o convite." };
  }
  return { ok: true };
}
