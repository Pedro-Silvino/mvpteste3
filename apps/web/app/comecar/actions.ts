"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { normalizePartnerCode, PARTNER_COOKIE } from "@/lib/partner";
import { clientIp, createOrgErrorMessage } from "@/lib/request";
import { createClient } from "@/lib/supabase/server";
import { organizationSchema } from "@/lib/validation/organization";

export type FormState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
  values?: Record<string, string>;
};

const FIELDS = ["name", "cnpj", "domain", "sector", "employeesRange"] as const;

export async function createOrganization(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(
    [...FIELDS, "acceptTerms"].map((k) => [k, formData.get(k) ?? undefined]),
  );
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(raw[k] ?? "")]));

  const parsed = organizationSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const ip = clientIp(await headers());
  const supabase = await createClient(ip ? { "x-forwarded-for": ip } : undefined);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?next=/comecar");

  const cookieStore = await cookies();
  const partner = normalizePartnerCode(cookieStore.get(PARTNER_COOKIE)?.value);

  const { error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_cnpj: parsed.data.cnpj,
    p_domain: parsed.data.domain,
    p_sector: parsed.data.sector,
    p_employees_range: parsed.data.employeesRange,
    p_partner_code: partner ?? "",
    p_terms_version: process.env.TERMS_VERSION ?? "1.0",
  });

  if (error) {
    // Internal log only: error code/message from Postgres, no form data or e-mail.
    console.error("create_organization failed", { code: error.code, message: error.message });
    return { error: createOrgErrorMessage(error.message), values };
  }

  cookieStore.delete(PARTNER_COOKIE);
  redirect("/diagnostico");
}
