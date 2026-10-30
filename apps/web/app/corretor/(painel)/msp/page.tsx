import Link from "next/link";
import { Card, PageHeader } from "@/app/painel/ui";
import { formatDateTime } from "@/lib/assessment-data";
import base12 from "@/lib/base12.json";
import { buildAccounts, filterAccounts, parseFilters, portfolioSummary, sortByAttention } from "@/lib/msp";
import { STAGE_LABEL } from "@/lib/partner-data";
import { requirePartner } from "@/lib/partner-session";
import { LEVEL_CHIP, LEVEL_LABEL } from "@/lib/readiness";

export const metadata = { title: "Console MSP — Sentinela" };

const STATUS_LABEL = { atende: "Atende", parcial: "Parcial", nao_atende: "Não atende", sem_dado: "Sem dado" } as const;
const STATUS_CHIP = {
  atende: "bg-green-100 text-green-800",
  parcial: "bg-amber-100 text-amber-800",
  nao_atende: "bg-red-100 text-red-800",
  sem_dado: "bg-slate-100 text-slate-600",
} as const;
const FILTERS = [
  { value: null, label: "Todas" },
  { value: "nao_pronta", label: "Ainda não prontas" },
  { value: "quase", label: "Quase prontas" },
  { value: "pronta", label: "Prontas" },
  { value: "sem_autorizacao", label: "Aguardando autorização" },
] as const;

export default async function MspPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { overview } = await requirePartner();
  const filters = parseFilters(await searchParams);
  const all = sortByAttention(buildAccounts(overview.clients));
  const summary = portfolioSummary(all);
  const rows = filterAccounts(all, filters);
  const selected = filters.conta ? all.find((a) => a.client.org_id === filters.conta && a.client.shared) : undefined;
  const href = (nivel: string | null, conta?: string) => {
    const q = new URLSearchParams();
    if (nivel) q.set("nivel", nivel);
    if (conta) q.set("conta", conta);
    const s = q.toString();
    return s ? `/corretor/msp?${s}` : "/corretor/msp";
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Console MSP"
        subtitle="Todas as suas subcontas em uma lista, da que mais precisa de atenção para a que menos precisa. Você só vê nota e controles das empresas que autorizaram o compartilhamento."
        action={<Link href="/corretor" className="link text-sm">Voltar aos clientes indicados</Link>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Subcontas", summary.total],
          ["Nota média (quem autorizou)", summary.average_score ?? "—"],
          ["Ainda não prontas", summary.nao_pronta],
          ["Aguardando autorização", summary.pending_authorization],
        ].map(([label, n]) => (
          <Card key={label as string}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-2 font-display text-4xl font-extrabold text-n1">{n}</p>
          </Card>
        ))}
      </div>

      <nav aria-label="Filtro por prontidão" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={href(f.value)}
            aria-current={filters.nivel === f.value ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${filters.nivel === f.value ? "bg-n1 text-white" : "bg-white text-n3 hover:bg-ice"}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <Card>
        <h2 className="text-lg font-bold text-n1">Subcontas ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nenhuma subconta nesse filtro.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 pr-3">Empresa</th>
                  <th className="py-2 pr-3">Etapa</th>
                  <th className="py-2 pr-3">Nota</th>
                  <th className="py-2 pr-3">Prontidão para o seguro</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ client: c, readiness: r }) => (
                  <tr key={c.org_id} className={selected?.client.org_id === c.org_id ? "bg-ice/50" : undefined}>
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-n1">{c.domain ?? "—"}</p>
                      <p className="text-xs text-muted">Entrou em {formatDateTime(c.created_at)}</p>
                    </td>
                    <td className="py-3 pr-3">{STAGE_LABEL[c.stage]}</td>
                    <td className="py-3 pr-3">{c.shared && c.score !== null ? c.score : "—"}</td>
                    <td className="py-3 pr-3">
                      {r ? (
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${LEVEL_CHIP[r.level]}`}>{LEVEL_LABEL[r.level]}</span>
                      ) : (
                        <span className="text-xs text-muted">Aguardando autorização do cliente</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {c.shared && (
                        <Link href={href(filters.nivel, c.org_id)} aria-label={`Monitorar ${c.domain ?? "empresa"}`} className="link text-xs">
                          Monitorar
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-n1">{selected.client.domain ?? "Empresa"}: os 12 controles</h2>
            <Link href={`/corretor/cliente/${selected.client.org_id}`} className="link text-sm">Ver detalhes e provas</Link>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {base12.controles.map((ctl) => {
              const st = (selected.client.controls as Record<string, keyof typeof STATUS_LABEL | undefined>)[ctl.id] ?? "sem_dado";
              return (
                <li key={ctl.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                  <span>{ctl.id} · {ctl.nome}</span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CHIP[st]}`}>{STATUS_LABEL[st]}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted">Retrato do ambiente na data da coleta, com base nas respostas da empresa e nas checagens automáticas.</p>
        </Card>
      )}
    </div>
  );
}
