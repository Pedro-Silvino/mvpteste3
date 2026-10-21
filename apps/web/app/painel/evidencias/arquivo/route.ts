import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Short-lived signed URL (5 min) for an evidence file of the signed-in user's company (RLS + bucket policy).
export async function GET(request: Request) {
  const id = z.uuid().safeParse(new URL(request.url).searchParams.get("id"));
  const back = NextResponse.redirect(new URL("/painel/evidencias", request.url));
  if (!id.success) return back;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/comecar", request.url));

  const { data: ev } = await supabase.from("evidence").select("storage_path, file_name").eq("id", id.data).maybeSingle();
  if (!ev) return back;
  const { data, error } = await supabase.storage.from("evidence").createSignedUrl(ev.storage_path, 300, { download: ev.file_name });
  if (error || !data) {
    console.error("evidence signed url failed", { message: error?.message });
    return back;
  }
  return NextResponse.redirect(data.signedUrl);
}
