"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type DocState = { ok?: boolean; error?: string };

const requestSchema = z.object({
  orgId: z.uuid(),
  kind: z.enum(["politica", "plano_incidente", "designacao"]),
  responsavel: z.string().trim().max(120),
});

export async function requestDocument(orgId: string, kind: string, _prev: DocState, formData: FormData): Promise<DocState> {
  const parsed = requestSchema.safeParse({ orgId, kind, responsavel: formData.get("responsavel") ?? "" });
  if (!parsed.success) return { error: "Não conseguimos fazer o pedido. Tente de novo." };
  if (parsed.data.kind === "designacao" && parsed.data.responsavel.length < 3) {
    return { error: "Informe o nome de quem será o responsável pela segurança." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_document", {
    p_org: parsed.data.orgId,
    p_kind: parsed.data.kind,
    p_params: { responsavel: parsed.data.responsavel },
  });
  if (error) {
    console.error("request_document failed", { code: error.code, message: error.message });
    return { error: error.message.includes("plan_required") ? "Disponível nos planos pagos." : "Não conseguimos fazer o pedido agora. Tente de novo." };
  }
  revalidatePath("/painel/documentos");
  return { ok: true };
}

export async function approveDocument(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("documentId"));
  if (!id.success) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_document", { p_document: id.data });
  if (error) console.error("approve_document failed", { code: error.code, message: error.message });
  revalidatePath("/painel/documentos");
  revalidatePath("/painel/sos");
}
