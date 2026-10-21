import { z } from "zod";
import { isValidCnpj, onlyDigits } from "../cnpj";

export const SECTORS = [
  { value: "servicos", label: "Serviços" },
  { value: "comercio", label: "Comércio / varejo" },
  { value: "industria", label: "Indústria" },
  { value: "saude", label: "Saúde" },
  { value: "juridico", label: "Jurídico / contabilidade" },
  { value: "cartorio", label: "Cartório" },
  { value: "educacao", label: "Educação" },
  { value: "tecnologia", label: "Tecnologia" },
  { value: "financeiro", label: "Financeiro / seguros" },
  { value: "outro", label: "Outro" },
] as const;

export const EMPLOYEE_RANGES = ["1-10", "11-50", "51-200", "201-500", "500+"] as const;

// Same steps as public.create_organization, so the user sees the domain that will be scanned.
export function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[/:?#].*$/, "")
    .replace(/^www\./, "");
}

// Short first step: only the domain is needed for the public checks. Company name, CNPJ, sector
// and size are collected later (the name defaults to the domain).
export const organizationSchema = z.object({
  domain: z
    .string()
    .transform(normalizeDomain)
    .refine((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d), "Informe o site ou domínio de e-mail (ex.: suaempresa.com.br)."),
  acceptTerms: z.literal("on", { message: "É preciso aceitar os termos para continuar." }),
});

export type OrganizationInput = z.infer<typeof organizationSchema>;

// Completed after the diagnostic, from the dashboard. Everything but the name is optional.
export const companyProfileSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da empresa.").max(160, "Nome muito longo."),
  cnpj: z
    .string()
    .trim()
    .refine((v) => v === "" || isValidCnpj(v), "CNPJ inválido. Confira os números.")
    .transform((v) => (v === "" ? "" : onlyDigits(v))),
  sector: z.union([z.literal(""), z.enum(SECTORS.map((s) => s.value) as [string, ...string[]])], { message: "Escolha o setor." }),
  employeesRange: z.union([z.literal(""), z.enum(EMPLOYEE_RANGES)], { message: "Escolha a faixa de funcionários." }),
});
