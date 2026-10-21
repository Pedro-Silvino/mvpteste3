"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/staff";

const planSchema = z.object({ orgId: z.uuid(), plan: z.enum(["express", "essencial", "dossie", "360"]) });
const alertSchema = z.object({ alertId: z.uuid() });
const reviewSchema = z.object({
  assessmentId: z.uuid(),
  orgId: z.uuid(),
  controlId: z.string().regex(/^C[0-9]{2}$/),
  status: z.enum(["atende", "parcial", "nao_atende", "sem_dado"]),
  note: z.string().trim().max(500),
});

export async function setPlan(formData: FormData) {
  const { supabase } = await requireStaff();
  const parsed = planSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { error } = await supabase.rpc("staff_set_plan", { p_org: parsed.data.orgId, p_plan: parsed.data.plan });
  if (error) console.error("staff_set_plan failed", { code: error.code, message: error.message });
  revalidatePath("/staff", "layout");
}

export async function resolveAlert(formData: FormData) {
  const { supabase } = await requireStaff();
  const parsed = alertSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { error } = await supabase.rpc("staff_resolve_alert", { p_alert: parsed.data.alertId });
  if (error) console.error("staff_resolve_alert failed", { code: error.code, message: error.message });
  revalidatePath("/staff", "layout");
}

export async function reviewControl(formData: FormData) {
  const { supabase } = await requireStaff();
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { error } = await supabase.rpc("staff_review_control", {
    p_assessment: parsed.data.assessmentId,
    p_control: parsed.data.controlId,
    p_status: parsed.data.status,
    p_note: parsed.data.note,
  });
  if (error) console.error("staff_review_control failed", { code: error.code, message: error.message });
  revalidatePath(`/staff/org/${parsed.data.orgId}`);
}
