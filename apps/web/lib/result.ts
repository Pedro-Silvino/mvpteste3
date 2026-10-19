import base12 from "./base12.json";

export function bandFor(score: number) {
  const b = base12.faixas.find((f) => score >= f.min && score <= f.max) ?? base12.faixas[0];
  return { label: b.rotulo, color: b.cor };
}

const SEVERITY: Record<string, number> = { nao_atende: 0, sem_dado: 1, parcial: 2 };
export const STATUS_LABEL: Record<string, string> = {
  atende: "Atende",
  parcial: "Parcial",
  nao_atende: "Não atende",
  sem_dado: "Sem dado",
};

// Same ordering as worker/app/engine/scoring.py: weight desc, severity, id.
export function topGaps(rows: { control_id: string; status: string }[], n = 3) {
  const byId = new Map(base12.controles.map((c) => [c.id, c]));
  return rows
    .filter((r) => r.status !== "atende" && byId.has(r.control_id))
    .sort(
      (a, b) =>
        byId.get(b.control_id)!.peso - byId.get(a.control_id)!.peso ||
        SEVERITY[a.status] - SEVERITY[b.status] ||
        a.control_id.localeCompare(b.control_id),
    )
    .slice(0, n)
    .map((r) => {
      const c = byId.get(r.control_id)!;
      return { id: c.id, name: c.nome, why: c.por_que, steps: c.ficha, status: r.status };
    });
}
