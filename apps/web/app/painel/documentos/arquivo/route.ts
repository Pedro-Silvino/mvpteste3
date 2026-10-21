import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const NAMES: Record<string, string> = { politica: "politica-de-seguranca", plano_incidente: "plano-de-incidente", designacao: "designacao-responsavel" };

// Short-lived signed URL (5 min) for a document of the signed-in user's company (RLS + bucket policy).
export async function GET(request: Request) {
  const id = z.uuid().safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success) return NextResponse.redirect(new URL("/painel/documentos", request.url));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/comecar", request.url));

  const { data: doc } = await supabase.from("documents").select("storage_path, kind, version").eq("id", id.data).maybeSingle();
  if (!doc) return NextResponse.redirect(new URL("/painel/documentos", request.url));

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, 300, { download: `${NAMES[doc.kind] ?? "documento"}-v${doc.version}.pdf` });
  if (error || !data) {
    console.error("document signed url failed", { message: error?.message });
    return NextResponse.redirect(new URL("/painel/documentos", request.url));
  }
  return NextResponse.redirect(data.signedUrl);
}
