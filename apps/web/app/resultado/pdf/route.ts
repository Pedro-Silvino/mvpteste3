import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    .select("storage_path")
    .eq("kind", "express")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!report) return NextResponse.redirect(new URL("/resultado", request.url));

  const { data, error } = await supabase.storage
    .from("reports")
    .createSignedUrl(report.storage_path, 300, { download: "diagnostico-express-sentinela.pdf" });
  if (error || !data) {
    console.error("createSignedUrl failed", { message: error?.message });
    return NextResponse.redirect(new URL("/resultado", request.url));
  }
  return NextResponse.redirect(data.signedUrl);
}
