import base12 from "./base12.json";

// Mirrors worker/app/engine/scoring.py (threat_exposure): same catalog, same rule, same tests.
export type Level = "Alto" | "Médio" | "Baixo" | "Sem dado";
export type Threat = { id: string; name: string; level: Level; how: string; loss: string };

const CONTROL_VALUE: Record<string, number> = { atende: 1, parcial: 0.5, nao_atende: 0, sem_dado: 0 };
const EXTERNAL_VALUE: Record<string, number> = { ok: 1, parcial: 0.5, falha: 0 }; // external no-data is left out
const ORDER: Record<Level, number> = { Alto: 0, Médio: 1, Baixo: 2, "Sem dado": 3 };
const controlWeight = new Map(base12.controles.map((c) => [c.id, c.peso]));
const externalWeight = new Map(base12.checagens_externas.map((c) => [c.id, c.peso]));

function levelFor(pct: number): Level {
  const hit = base12.niveis_exposicao.find((n) => pct <= n.max) ?? base12.niveis_exposicao.at(-1)!;
  return hit.rotulo as Level;
}

export function threatExposure(
  rows: { control_id: string; status: string }[],
  externalChecks: Record<string, string> | null | undefined,
): Threat[] {
  const status = new Map(rows.map((r) => [r.control_id, r.status]));
  const ext = externalChecks ?? {};
  return base12.ameacas
    .map((t) => {
      const items: [number, number][] = t.controles.map((c) => [
        controlWeight.get(c) ?? 0,
        CONTROL_VALUE[status.get(c) ?? "sem_dado"] ?? 0,
      ]);
      for (const x of t.checagens) {
        if (ext[x] in EXTERNAL_VALUE) items.push([externalWeight.get(x) ?? 0, EXTERNAL_VALUE[ext[x]]]);
      }
      const total = items.reduce((a, [w]) => a + w, 0);
      const pct = total ? Math.round((100 * items.reduce((a, [w, v]) => a + w * v, 0)) / total) : null;
      const level: Level = pct === null ? "Sem dado" : levelFor(pct);
      return { id: t.id, name: t.nome, level, how: t.como_acontece, loss: t.prejuizo };
    })
    .sort((a, b) => ORDER[a.level] - ORDER[b.level]);
}

export function opportunities(): string[] {
  return [...base12.oportunidades];
}
