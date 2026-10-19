"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isValidAnswer } from "@/lib/questionnaire";
import { createClient } from "@/lib/supabase/server";

const saveSchema = z.object({
  assessmentId: z.uuid(),
  questionId: z.string().regex(/^(C[0-9]{2}|Q_[A-Z_]{2,30})$/),
  value: z.string().max(40),
});

// Saves one answer. RLS only lets owner/ti write while the assessment is a draft.
export async function saveAnswer(input: { assessmentId: string; questionId: string; value: string }) {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success || !isValidAnswer(parsed.data.questionId, parsed.data.value)) {
    return { ok: false as const };
  }
  const supabase = await createClient();
  const { assessmentId, questionId, value } = parsed.data;
  // Not upsert: the table only grants UPDATE on (value, answered_at), and ON CONFLICT DO UPDATE
  // would also try to set the key columns. So: update first, insert when nothing was there yet.
  const updated = await supabase
    .from("answers")
    .update({ value, answered_at: new Date().toISOString() })
    .eq("assessment_id", assessmentId)
    .eq("question_id", questionId)
    .select("question_id");
  if (updated.error) {
    console.error("saveAnswer update failed", { code: updated.error.code, message: updated.error.message });
    return { ok: false as const };
  }
  if (updated.data.length > 0) return { ok: true as const };

  const { error } = await supabase
    .from("answers")
    .insert({ assessment_id: assessmentId, question_id: questionId, value });
  if (error) {
    console.error("saveAnswer insert failed", { code: error.code, message: error.message });
    return { ok: false as const };
  }
  return { ok: true as const };
}

export async function submitAssessment(assessmentId: string) {
  if (!z.uuid().safeParse(assessmentId).success) return { ok: false as const };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_assessment", { p_assessment: assessmentId });
  if (error) {
    console.error("submit_assessment failed", { code: error.code, message: error.message });
    return { ok: false as const };
  }
  redirect("/resultado");
}
