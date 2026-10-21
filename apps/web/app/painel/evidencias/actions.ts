"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { detectMime, MAX_BYTES, pathBelongsTo, sha256Hex } from "@/lib/evidence";
import { currentOrgId } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  controlId: z.string().regex(/^C[0-9]{2}$/),
  path: z.string().min(10).max(300),
  fileName: z.string().trim().min(1).max(120),
});

// The browser already put the file in the private bucket. Here the SERVER reads it back, checks the real file
// type and size, computes the SHA-256 and only then registers it (RLS also requires a paid plan and owner/ti).
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

  const { data: blob, error: dlError } = await supabase.storage.from("evidence").download(parsed.data.path);
  if (dlError || !blob) {
    console.error("evidence download failed", { message: dlError?.message });
    return { ok: false, error: "Não encontramos o arquivo enviado. Tente de novo." };
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_BYTES) return { ok: false, error: "O arquivo precisa ter até 10 MB." };
  const mime = detectMime(bytes);
  if (!mime) return { ok: false, error: "Tipo de arquivo não aceito. Envie PDF, PNG ou JPG." };

  const { error } = await supabase.from("evidence").insert({
    org_id: orgId,
    control_id: parsed.data.controlId,
    storage_path: parsed.data.path,
    file_name: parsed.data.fileName,
    mime,
    size_bytes: bytes.length,
    sha256: sha256Hex(bytes),
  });
  if (error) {
    console.error("evidence insert failed", { code: error.code, message: error.message });
    return { ok: false, error: "Não conseguimos registrar o arquivo. Confira o seu plano e tente de novo." };
  }
  revalidatePath("/painel/evidencias");
  return { ok: true };
}
