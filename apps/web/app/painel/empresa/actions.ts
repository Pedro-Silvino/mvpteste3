"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { companyProfileSchema } from "@/lib/validation/organization";
import { createClient } from "@/lib/supabase/server";

export type ProfileState = { ok?: boolean; error?: string; fieldErrors?: Partial<Record<string, string[]>> };

const FIELDS = ["name", "cnpj", "sector", "employeesRange"] as const;

export async function saveCompanyProfile(orgId: string, _prev: ProfileState, formData: FormData): Promise<ProfileState> {
  if (!z.uuid().safeParse(orgId).success) return { error: "Não conseguimos salvar. Tente de novo." };
  const parsed = companyProfileSchema.safeParse(Object.fromEntries(FIELDS.map((k) => [k, formData.get(k) ?? ""])));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_organization_profile", {
    p_org: orgId,
    p_name: parsed.data.name,
    p_cnpj: parsed.data.cnpj,
    p_sector: parsed.data.sector,
    p_employees_range: parsed.data.employeesRange,
  });
  if (error) {
    console.error("update_organization_profile failed", { code: error.code, message: error.message });
    return { error: "Não conseguimos salvar. Confira os dados e tente de novo." };
  }
  revalidatePath("/painel", "layout");
  return { ok: true };
}
