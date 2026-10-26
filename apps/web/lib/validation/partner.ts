import { z } from "zod";

export const PARTNER_KINDS = [
  { value: "corretor", label: "Corretora de seguros" },
  { value: "msp", label: "Empresa de TI / MSP que indica clientes" },
] as const;

// SUSEP number is optional here (the team checks it before activating benefits); only digits are kept.
export const partnerSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome da corretora.").max(120, "Nome muito longo."),
  kind: z.enum(PARTNER_KINDS.map((k) => k.value) as [string, ...string[]], { message: "Escolha o tipo." }),
  susep: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length <= 20, "Número da SUSEP muito longo."),
});

export type PartnerInput = z.infer<typeof partnerSchema>;

const GENERIC = "Não conseguimos concluir o cadastro agora. Tente de novo em alguns minutos.";

// Maps known exceptions from public.register_partner; never echoes database details.
export function partnerErrorMessage(dbMessage: string | undefined): string {
  if (dbMessage?.includes("already_partner")) return "Esta conta já tem uma corretora cadastrada.";
  if (dbMessage?.includes("account_required")) return "Crie uma conta com e-mail e senha para cadastrar a corretora.";
  return GENERIC;
}
