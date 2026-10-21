import { NextResponse } from "next/server";
import { z } from "zod";
import { isPaidPlan } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

// Short-lived signed URL (5 min) for one report of the signed-in user's company (RLS + bucket policy).
// The history is a paid feature: on the free plan only the free PDF is reachable, through /resultado/pdf.
export async function GET(request: Request) {
  const id = z.uuid().safeParse(new URL(request.url).searchParams.get("id"));
  const back = NextResponse.redirect(new URL("/painel/relatorio", request.url));
  if (!id.success) return back;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/comecar", request.url));

  const { data: report } = await supabase.from("reports").select("storage_path, kind, created_at, org_id").eq("id", id.data).maybeSingle();
  if (!report) return back;
  const { data: org } = await supabase.from("organizations").select("plan").eq("id", report.org_id).maybeSingle();
  if (!isPaidPlan(org?.plan)) return back;

  const day = report.created_at.slice(0, 10);
  const { data, error } = await supabase.storage
    .from("reports")
    .createSignedUrl(report.storage_path, 300, { download: `sentinela-${report.kind}-${day}.pdf` });
  if (error || !data) {
    console.error("report signed url failed", { message: error?.message });
    return back;
  }
  return NextResponse.redirect(data.signedUrl);
}
