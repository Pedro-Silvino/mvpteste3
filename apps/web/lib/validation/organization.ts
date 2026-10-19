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

const sectorValues = SECTORS.map((s) => s.value) as [string, ...string[]];

export const organizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe o nome da empresa.")
    .max(160, "Nome muito longo."),
  cnpj: z
    .string()
    .refine(isValidCnpj, "CNPJ inválido. Confira os números.")
    .transform(onlyDigits),
  domain: z
    .string()
    .transform(normalizeDomain)
    .refine((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d), "Informe o site ou domínio de e-mail (ex.: suaempresa.com.br)."),
  sector: z.enum(sectorValues, { message: "Escolha o setor." }),
  employeesRange: z.enum(EMPLOYEE_RANGES, { message: "Escolha a faixa de funcionários." }),
  acceptTerms: z.literal("on", { message: "É preciso aceitar os termos para continuar." }),
});

export type OrganizationInput = z.infer<typeof organizationSchema>;
