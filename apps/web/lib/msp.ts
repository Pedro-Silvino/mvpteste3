import { z } from "zod";
import { clientReadiness, type PartnerClient } from "./partner-data";
import type { Readiness, ReadinessLevel } from "./readiness";

// Consolidated view for MSPs and brokers: every sub-account in one list. It only works with what
// public.partner_overview() already sends, so an account that did not authorize sharing shows no score or controls.
export type MspAccount = { client: PartnerClient; readiness: Readiness | null };

export const buildAccounts = (clients: PartnerClient[]): MspAccount[] => clients.map((client) => ({ client, readiness: clientReadiness(client) }));

// Worst posture first. Accounts that have not authorized sharing go last (nothing to act on yet).
const URGENCY: Record<ReadinessLevel, number> = { nao_pronta: 0, quase: 1, sem_diagnostico: 2, pronta: 3 };

export function sortByAttention(accounts: MspAccount[]): MspAccount[] {
  return [...accounts].sort((a, b) => {
    if (!a.readiness !== !b.readiness) return a.readiness ? -1 : 1;
    if (a.readiness && b.readiness) {
      const d = URGENCY[a.readiness.level] - URGENCY[b.readiness.level];
      if (d) return d;
    }
    return (a.client.score ?? 101) - (b.client.score ?? 101) || (a.client.domain ?? "").localeCompare(b.client.domain ?? "");
  });
}

export function portfolioSummary(accounts: MspAccount[]) {
  const visible = accounts.filter((a) => a.client.shared);
  const scores = visible.map((a) => a.client.score).filter((s): s is number => s !== null);
  const count = (level: ReadinessLevel) => visible.filter((a) => a.readiness?.level === level).length;
  return {
    total: accounts.length,
    visible: visible.length,
    pending_authorization: accounts.length - visible.length,
    pronta: count("pronta"),
    quase: count("quase"),
    nao_pronta: count("nao_pronta"),
    average_score: scores.length ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : null,
  };
}

const filtersSchema = z.object({
  nivel: z.enum(["pronta", "quase", "nao_pronta", "sem_autorizacao"]).nullable(),
  conta: z.uuid().nullable(),
});
export type MspFilters = z.infer<typeof filtersSchema>;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

export function parseFilters(params: Record<string, string | string[] | undefined>): MspFilters {
  const nivel = filtersSchema.shape.nivel.safeParse(one(params.nivel));
  const conta = filtersSchema.shape.conta.safeParse(one(params.conta));
  return { nivel: nivel.success ? nivel.data : null, conta: conta.success ? conta.data : null };
}

export function filterAccounts(accounts: MspAccount[], f: MspFilters): MspAccount[] {
  if (!f.nivel) return accounts;
  if (f.nivel === "sem_autorizacao") return accounts.filter((a) => !a.client.shared);
  return accounts.filter((a) => a.readiness?.level === f.nivel);
}
