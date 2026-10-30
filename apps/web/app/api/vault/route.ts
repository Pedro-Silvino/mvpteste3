import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { detectMime, MAX_BYTES } from "@/lib/evidence-client";
import { currentOrgId } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { canUseVault, sha256Hex, vaultErrorStatus, vaultInputSchema, VAULT_CATEGORIES, vaultPathOk } from "@/lib/vault";

// The vault tables are not in database.types.ts until the migration is applied and the types regenerated,
// so these routes use the untyped client. RLS and the vault_register function still enforce access.
async function session() {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const orgId = await currentOrgId(supabase, user.id);
  return orgId ? { supabase, orgId } : null;
}

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

// List the company's vault items (never the file path; the file is only reachable by signed URL elsewhere).
export async function GET(request: Request) {
  const s = await session();
  if (!s) return fail(401, "Entre na sua conta para ver o cofre.");
  const category = new URL(request.url).searchParams.get("categoria");
  if (category && !(VAULT_CATEGORIES as readonly string[]).includes(category)) return fail(400, "Categoria inválida.");

  let query = s.supabase
    .from("evidence_vault")
    .select("id, title, category, file_hash_sha256, created_at")
    .eq("organization_id", s.orgId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (category) query = query.eq("category", category);
  const { data, error } = await query;
  if (error) {
    console.error("vault list failed", { message: error.message });
    return fail(500, "Não foi possível carregar o cofre agora.");
  }
  return NextResponse.json({ items: data ?? [] });
}

// Register a file the browser already uploaded to {org}/vault/. The server reads it back, checks the real
// type and recomputes the SHA-256; if it differs from the hash the browser reported, nothing is registered.
export async function POST(request: Request) {
  const s = await session();
  if (!s) return fail(401, "Entre na sua conta para guardar no cofre.");
  if (Number(request.headers.get("content-length") ?? 0) > 20_000) return fail(413, "Pedido grande demais.");

  const body = vaultInputSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail(400, "Confira o título, a categoria e o arquivo.");
  const input = body.data;
  if (!vaultPathOk(input.path, s.orgId)) return fail(400, "Arquivo fora da pasta do cofre.");

  const { data: org } = await s.supabase.from("organizations").select("plan").eq("id", s.orgId).maybeSingle();
  if (!canUseVault(org?.plan)) return fail(403, "O cofre de evidências faz parte dos planos pagos.");

  const { data: blob, error: dlError } = await s.supabase.storage.from("evidence").download(input.path);
  if (dlError || !blob) return fail(400, "Não encontramos o arquivo enviado. Envie de novo.");
  if (blob.size === 0 || blob.size > MAX_BYTES) return fail(400, "O arquivo precisa ter até 10 MB.");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (!detectMime(bytes)) return fail(400, "Envie PDF, PNG ou JPG.");

  const sha256 = await sha256Hex(bytes);
  if (sha256 !== input.sha256) return fail(422, "O arquivo recebido não confere com o código de verificação informado.");

  const { data: id, error } = await s.supabase.rpc("vault_register", {
    p_org: s.orgId,
    p_title: input.title,
    p_category: input.category,
    p_file_path: input.path,
    p_hash: sha256,
    p_metadata: input.metadata ?? {},
  });
  if (error) {
    const status = vaultErrorStatus(error.message);
    if (status === 400) console.error("vault_register failed", { message: error.message });
    return fail(status, status === 403 ? "Você não tem permissão para guardar no cofre." : "Não foi possível guardar a evidência.");
  }
  return NextResponse.json({ id, sha256 }, { status: 201 });
}
