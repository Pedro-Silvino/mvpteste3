import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function back(request: Request, error: string) {
  return NextResponse.redirect(new URL(`/resultado?erro=${error}`, request.url));
}

// Short-lived signed URL (5 min) for the latest Express report of the signed-in user's company.
// RLS limits `reports` and the private bucket to members of that company.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/comecar", request.url));

  const { data: report } = await supabase
    .from("reports")
    .select("storage_path, created_at, org_id")
    .eq("kind", "express")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!report) return back(request, "sem-relatorio");

  const { data: org } = await supabase.from("organizations").select("domain").eq("id", report.org_id).maybeSingle();
  const slug = (org?.domain ?? "empresa").replace(/[^a-z0-9.-]/gi, "").slice(0, 60);
  const day = report.created_at.slice(0, 10);

  const { data, error } = await supabase.storage
    .from("reports")
    .createSignedUrl(report.storage_path, 300, { download: `sentinela-diagnostico-${slug}-${day}.pdf` });
  if (error || !data) {
    console.error("createSignedUrl failed", { message: error?.message });
    return back(request, "download");
  }
  return NextResponse.redirect(data.signedUrl);
}
