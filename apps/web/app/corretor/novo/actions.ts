"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { partnerErrorMessage, partnerSchema } from "@/lib/validation/partner";
import { createClient } from "@/lib/supabase/server";

export type PartnerFormState = { error?: string; fieldErrors?: Partial<Record<string, string[]>>; values?: Record<string, string> };

const FIELDS = ["name", "kind", "susep"] as const;

export async function registerPartner(_prev: PartnerFormState, formData: FormData): Promise<PartnerFormState> {
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(formData.get(k) ?? "")]));
  const parsed = partnerSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/corretor/cadastro");

  const { error } = await supabase.rpc("register_partner", { p_name: parsed.data.name, p_kind: parsed.data.kind, p_susep: parsed.data.susep });
  if (error) {
    console.error("register_partner failed", { code: error.code, message: error.message });
    if (error.message.includes("already_partner")) redirect("/corretor");
    return { error: partnerErrorMessage(error.message), values };
  }
  redirect("/corretor");
}
