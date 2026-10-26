"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// A diagnostic that failed goes back to the queue (retry_assessment checks the role and that it really failed).
export async function retryAssessment(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("assessmentId"));
  if (!id.success) redirect("/painel?erro=reprocessar");
  const supabase = await createClient();
  const { error } = await supabase.rpc("retry_assessment", { p_assessment: id.data });
  if (error) {
    console.error("retry_assessment failed", { code: error.code, message: error.message });
    redirect("/painel?erro=reprocessar");
  }
  redirect("/painel");
}
