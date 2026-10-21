"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type TokenState = { token?: string; error?: string };

const labelSchema = z.string().trim().min(2, "Dê um nome ao token (ex.: TI matriz).").max(60, "Nome muito longo (máximo 60).");

// The plain token exists only in this response. The database keeps just its SHA-256.
export async function createToken(orgId: string, _prev: TokenState, formData: FormData): Promise<TokenState> {
  if (!z.uuid().safeParse(orgId).success) return { error: "Não conseguimos gerar o token. Tente de novo." };
  const label = labelSchema.safeParse(formData.get("label") ?? "");
  if (!label.success) return { error: label.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_agent_token", { p_org: orgId, p_label: label.data });
  if (error || !data) {
    console.error("create_agent_token failed", { code: error?.code, message: error?.message });
    return { error: error?.message.includes("limit_tokens") ? "Limite de 5 tokens ativos. Revogue um para gerar outro." : "Não conseguimos gerar o token agora. Tente de novo." };
  }
  revalidatePath("/painel/agente");
  return { token: data };
}

export async function revokeToken(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("tokenId"));
  if (!id.success) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_agent_token", { p_token_id: id.data });
  if (error) console.error("revoke_agent_token failed", { code: error.code, message: error.message });
  revalidatePath("/painel/agente");
}
