import { z } from "zod";

// Same list as the check on public.evidence_vault.category.
export const VAULT_CATEGORIES = ["politica", "backup", "mfa", "patch", "continuidade", "treinamento", "contrato", "laudo", "outro"] as const;
export type VaultCategory = (typeof VAULT_CATEGORIES)[number];

export const VAULT_CATEGORY_LABEL: Record<VaultCategory, string> = {
  politica: "Política de segurança",
  backup: "Backup",
  mfa: "Verificação em duas etapas (MFA)",
  patch: "Atualizações",
  continuidade: "Continuidade e incidentes",
  treinamento: "Treinamento",
  contrato: "Contratos",
  laudo: "Laudos e auditorias",
  outro: "Outros",
};

// Mirrors public.org_can_use_vault (the database is the real gate; this only decides what the screen shows).
export function canUseVault(plan: string | null | undefined): boolean {
  return plan === "pro" || plan === "scale" || plan === "dossie" || plan === "360";
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// The browser uploads straight to Storage; the server only trusts a file that sits alone in {org}/vault/.
export function vaultPathOk(path: string, orgId: string): boolean {
  const prefix = `${orgId}/vault/`;
  if (!path.startsWith(prefix)) return false;
  const name = path.slice(prefix.length);
  return name.length > 0 && name.length <= 200 && !name.includes("..") && /^[A-Za-z0-9._-]+$/.test(name);
}

export const vaultInputSchema = z.strictObject({
  path: z.string().min(1).max(400),
  sha256: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/)
    .transform((h) => h.toLowerCase()),
  title: z.string().trim().min(3).max(160),
  category: z.enum(VAULT_CATEGORIES),
  metadata: z
    .record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean()]))
    .refine((m) => Object.keys(m).length <= 20)
    .optional(),
});
export type VaultInput = z.infer<typeof vaultInputSchema>;

// Maps the exceptions raised by public.vault_register to an HTTP status; the message sent to the client is generic.
export function vaultErrorStatus(dbMessage: string | undefined): number {
  return dbMessage === "forbidden" || dbMessage === "plan_required" ? 403 : 400;
}
