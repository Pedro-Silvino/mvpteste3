import { z } from "zod";
import { normalizePartnerCode } from "./partner";
import { evaluateReadiness, type ControlStatus, type Readiness } from "./readiness";

// What the broker panel receives from public.partner_overview() / partner_client_detail(). Validated before use:
// the database already limits what leaves it, this only keeps a surprise from reaching the screen.
const status = z.enum(["atende", "parcial", "nao_atende", "sem_dado"]);
const controls = z.record(z.string().regex(/^C[0-9]{2}$/), status).default({});

const snapshot = {
  score: z.number().int().nullable().default(null),
  external_score: z.number().int().nullable().default(null),
  assessment_kind: z.string().nullable().default(null),
  completed_at: z.string().nullable().default(null),
  controls,
  collector_devices: z.number().int().default(0),
};

const client = z.object({
  org_id: z.uuid(),
  domain: z.string().nullable(),
  created_at: z.string(),
  shared: z.boolean(),
  stage: z.enum(["iniciado", "processando", "concluido"]),
  evidence_controls: z.array(z.string().regex(/^C[0-9]{2}$/)).default([]),
  ...snapshot,
});

const overview = z.object({
  partner: z.object({ name: z.string(), code: z.string().regex(/^[a-z0-9-]{3,40}$/), kind: z.string() }),
  clients: z.array(client),
});

const detail = z.object({
  org_id: z.uuid(),
  domain: z.string().nullable(),
  name: z.string(),
  sector: z.string().nullable(),
  employees_range: z.string().nullable(),
  plan: z.string(),
  created_at: z.string(),
  ...snapshot,
  external_checks: z.record(z.string(), z.string()).nullable().default(null),
  evidence: z.array(
    z.object({ control_id: z.string(), file_name: z.string(), created_at: z.string(), sha256: z.string() }),
  ),
});

export type PartnerClient = z.infer<typeof client>;
export type PartnerOverview = z.infer<typeof overview>;
export type PartnerClientDetail = z.infer<typeof detail>;

export const parseOverview = (data: unknown): PartnerOverview => overview.parse(data);
export const parseDetail = (data: unknown): PartnerClientDetail => detail.parse(data);

// Readiness only exists for clients that authorized sharing (without it the database sends no diagnostic data).
export function clientReadiness(c: Pick<PartnerClient, "shared" | "controls" | "evidence_controls">): Readiness | null {
  if (!c.shared) return null;
  return evaluateReadiness(c.controls as Record<string, ControlStatus>, c.evidence_controls);
}

export function partnerLink(appUrl: string, code: string): string {
  const safe = normalizePartnerCode(code);
  if (!safe) throw new Error("invalid_partner_code");
  return `${appUrl.replace(/\/+$/, "")}/comecar?p=${safe}`;
}

export const STAGE_LABEL = { iniciado: "Diagnóstico iniciado", processando: "Calculando", concluido: "Diagnóstico concluído" } as const;
