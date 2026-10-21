import { NextResponse } from "next/server";
import { currentOrgId } from "@/lib/org";
import { isPaidPlan } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

function back(request: Request, error: string) {
  return NextResponse.redirect(new URL(`/resultado?erro=${error}`, request.url));
}

// Short-lived signed URL (5 min). Free plan gets the free PDF (score + totals); paid plans get the full one
// (gaps + how to fix). The worker stores both: ".../express.pdf" and ".../express-completo.pdf".
// RLS limits `reports` and the private bucket to members of the company.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/comecar", request.url));

  const orgId = await currentOrgId(supabase, user.id);
  if (!orgId) return NextResponse.redirect(new URL("/comecar", request.url));
  const { data: reports } = await supabase
    .from("reports")
    .select("storage_path, created_at, org_id")
    .eq("org_id", orgId)
    .eq("kind", "express")
    .order("created_at", { ascending: false })
    .limit(10);
  if (!reports?.length) return back(request, "sem-relatorio");

  const { data: org } = await supabase.from("organizations").select("domain, plan").eq("id", orgId).maybeSingle();
  const paid = isPaidPlan(org?.plan);
  const wanted = paid ? "-completo.pdf" : "/express.pdf";
  const report = reports.find((r) => r.storage_path.endsWith(wanted)) ?? reports[0];

  const slug = (org?.domain ?? "empresa").replace(/[^a-z0-9.-]/gi, "").slice(0, 60);
  const day = report.created_at.slice(0, 10);
  const { data, error } = await supabase.storage
    .from("reports")
    .createSignedUrl(report.storage_path, 300, {
      download: `sentinela-${paid ? "relatorio-completo" : "diagnostico"}-${slug}-${day}.pdf`,
    });
  if (error || !data) {
    console.error("createSignedUrl failed", { message: error?.message });
    return back(request, "download");
  }
  return NextResponse.redirect(data.signedUrl);
}
