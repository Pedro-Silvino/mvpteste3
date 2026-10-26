import Link from "next/link";
import { formatDateTime } from "@/lib/assessment-data";
import { planName } from "@/lib/plans";
import { requireStaff } from "@/lib/staff";
import { Card, PageHeader } from "../painel/ui";
import { resolveAlert, setPartnerActive } from "./actions";

const SEVERITY: Record<string, string> = {
  critico: "bg-red-100 text-red-800",
  atencao: "bg-amber-100 text-amber-800",
  info: "bg-sky/30 text-n3",
};

export default async function StaffHomePage() {
  const { supabase } = await requireStaff();
  const [{ data: orgs }, { data: assessments }, { data: alerts }, { data: partners }] = await Promise.all([
    supabase.from("organizations").select("id, name, domain, plan, created_at, partner_id").order("created_at", { ascending: false }).limit(200),
    supabase
      .from("assessments")
      .select("org_id, score, status, created_at")
      .eq("kind", "express")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("alerts").select("id, org_id, severity, message, created_at").is("resolved_at", null).order("created_at", { ascending: false }).limit(100),
    supabase.from("partners").select("id, name, code, kind, susep, active, created_at").order("created_at", { ascending: false }).limit(200),
  ]);
  const clientsByPartner = new Map<string, number>();
  for (const o of orgs ?? []) if (o.partner_id) clientsByPartner.set(o.partner_id, (clientsByPartner.get(o.partner_id) ?? 0) + 1);

  const latest = new Map<string, { score: number | null; status: string }>();
  for (const a of assessments ?? []) if (!latest.has(a.org_id)) latest.set(a.org_id, { score: a.score, status: a.status });
  const orgName = new Map((orgs ?? []).map((o) => [o.id, o.domain ?? o.name]));
  const openByOrg = new Map<string, number>();
  for (const a of alerts ?? []) openByOrg.set(a.org_id, (openByOrg.get(a.org_id) ?? 0) + 1);
  const sorted = [...(alerts ?? [])].sort((a, b) => (a.severity === "critico" ? -1 : 0) - (b.severity === "critico" ? -1 : 0));

  return (
    <>
      <PageHeader title="Visão da equipe" subtitle="Pedidos de plano, SOS e todas as empresas cadastradas." />

      <Card className="mb-6">
        <h2 className="text-lg font-bold text-n1">Alertas abertos ({alerts?.length ?? 0})</h2>
        {sorted.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nada pendente.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {sorted.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <span className={`mr-2 rounded-full px-2.5 py-0.5 text-xs font-semibold ${SEVERITY[a.severity]}`}>{a.severity}</span>
                  <Link href={`/staff/org/${a.org_id}`} className="font-semibold text-n1 hover:text-teal-strong">
                    {orgName.get(a.org_id) ?? a.org_id}
                  </Link>
                  <p className="mt-0.5 text-sm text-muted">{a.message}</p>
                  <p className="text-xs text-muted">{formatDateTime(a.created_at)}</p>
                </div>
                <form action={resolveAlert}>
                  <input type="hidden" name="alertId" value={a.id} />
                  <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-n3 hover:bg-ice">Resolver</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-6">
        <h2 className="text-lg font-bold text-n1">Corretoras ({partners?.length ?? 0})</h2>
        {(partners ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nenhuma corretora cadastrada.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 pr-3">Corretora</th>
                  <th className="py-2 pr-3">SUSEP</th>
                  <th className="py-2 pr-3">Clientes</th>
                  <th className="py-2 pr-3">Situação</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(partners ?? []).map((pt) => (
                  <tr key={pt.id}>
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-n1">{pt.name}</p>
                      <p className="font-mono text-xs text-muted">{pt.code}</p>
                    </td>
                    <td className="py-3 pr-3">{pt.susep ?? "—"}</td>
                    <td className="py-3 pr-3">{clientsByPartner.get(pt.id) ?? 0}</td>
                    <td className="py-3 pr-3">{pt.active ? "Ativa" : "Desativada"}</td>
                    <td className="py-3 text-right">
                      <form action={setPartnerActive}>
                        <input type="hidden" name="partnerId" value={pt.id} />
                        <input type="hidden" name="active" value={pt.active ? "false" : "true"} />
                        <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-n3 hover:bg-ice">
                          {pt.active ? "Desativar" : "Ativar"}
                          <span className="sr-only"> {pt.name}</span>
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-bold text-n1">Empresas ({orgs?.length ?? 0})</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="py-2 pr-3">Empresa</th>
                <th className="py-2 pr-3">Plano</th>
                <th className="py-2 pr-3">Nota</th>
                <th className="py-2 pr-3">Alertas</th>
                <th className="py-2">Cadastro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(orgs ?? []).map((o) => {
                const a = latest.get(o.id);
                return (
                  <tr key={o.id}>
                    <td className="py-3 pr-3">
                      <Link href={`/staff/org/${o.id}`} className="font-semibold text-n1 hover:text-teal-strong">
                        {o.domain ?? o.name}
                      </Link>
                      {o.domain && o.name !== o.domain && <p className="text-xs text-muted">{o.name}</p>}
                    </td>
                    <td className="py-3 pr-3">{planName(o.plan)}</td>
                    <td className="py-3 pr-3">{a?.status === "concluido" ? a.score : a ? a.status : "—"}</td>
                    <td className="py-3 pr-3">{openByOrg.get(o.id) ?? 0}</td>
                    <td className="py-3 text-muted">{formatDateTime(o.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
