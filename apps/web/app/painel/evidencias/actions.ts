"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { pathBelongsTo } from "@/lib/evidence-client";
import { currentOrgId } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  controlId: z.string().regex(/^C[0-9]{2}$/),
  path: z.string().min(10).max(300),
  fileName: z.string().trim().min(1).max(120),
});

// The browser already put the file in the private bucket. Registration is the worker's job: it reads the file back,
// checks the real type and size and computes the SHA-256 (the client never supplies the hash). Here we only ask for it.
export async function registerEvidence(input: { controlId: string; path: string; fileName: string }): Promise<{ ok: boolean; error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados do envio inválidos." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre de novo." };
  const orgId = await currentOrgId(supabase, user.id);
  if (!orgId || !pathBelongsTo(parsed.data.path, orgId, parsed.data.controlId)) return { ok: false, error: "Arquivo inválido." };

  const { error } = await supabase.rpc("request_evidence_registration", {
    p_org: orgId,
    p_control: parsed.data.controlId,
    p_path: parsed.data.path,
    p_file_name: parsed.data.fileName,
  });
  if (error) {
    console.error("request_evidence_registration failed", { code: error.code, message: error.message });
    return { ok: false, error: "Não conseguimos registrar o arquivo. Confira o seu plano e tente de novo." };
  }
  revalidatePath("/painel/evidencias");
  return { ok: true };
}
