"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { incidentSchema } from "@/lib/validation/incident";
import { createClient } from "@/lib/supabase/server";

export type SosState = { ok?: boolean; error?: string };

export async function openIncident(orgId: string, _prev: SosState, formData: FormData): Promise<SosState> {
  if (!z.uuid().safeParse(orgId).success) return { error: "Não conseguimos abrir o chamado. Tente de novo." };
  const parsed = incidentSchema.safeParse({ description: formData.get("description") ?? "" });
  if (!parsed.success) return { error: z.flattenError(parsed.error).fieldErrors.description?.[0] ?? "Descreva o que aconteceu." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("open_incident", { p_org: orgId, p_description: parsed.data.description });
  if (error) {
    console.error("open_incident failed", { code: error.code, message: error.message });
    return { error: "Não conseguimos abrir o chamado agora. Tente de novo em instantes." };
  }
  revalidatePath("/painel/sos");
  return { ok: true };
}
