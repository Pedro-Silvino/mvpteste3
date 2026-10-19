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
  const { error } = await supabase.from("answers").upsert(
    {
      assessment_id: parsed.data.assessmentId,
      question_id: parsed.data.questionId,
      value: parsed.data.value,
      answered_at: new Date().toISOString(),
    },
    { onConflict: "assessment_id,question_id" },
  );
  if (error) {
    console.error("saveAnswer failed", { code: error.code });
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
