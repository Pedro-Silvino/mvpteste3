import Link from "next/link";
import { CopyButton } from "@/app/_components/copy-button";
import { Card, PageHeader } from "@/app/painel/ui";
import { formatDateTime } from "@/lib/assessment-data";
import { clientReadiness, partnerLink, STAGE_LABEL } from "@/lib/partner-data";
import { appUrl, requirePartner } from "@/lib/partner-session";
import { LEVEL_CHIP, LEVEL_LABEL } from "@/lib/readiness";

export default async function CorretorHomePage() {
  const { overview } = await requirePartner();
  const link = partnerLink(appUrl(), overview.partner.code);
  const message = `Olá! Preparei um diagnóstico gratuito de segurança digital para a sua empresa. Leva uns 15 minutos e mostra como estão os controles que as seguradoras de seguro cibernético costumam perguntar: ${link}`;

  const clients = overview.clients;
  const rows = clients.map((c) => ({ c, r: clientReadiness(c) }));
  const done = clients.filter((c) => c.stage === "concluido").length;
  const authorized = clients.filter((c) => c.shared).length;
  const ready = rows.filter((x) => x.r?.level === "pronta").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clientes indicados"
        subtitle="Quem entrou pelo seu link, em que etapa está e se já tem as provas que a seguradora costuma pedir."
      />

      <Card>
        <h2 className="text-lg font-bold text-n1">Seu link de indicação</h2>
        <p className="mt-1 text-sm text-muted">Quem abrir este link faz o diagnóstico gratuito já ligado à sua corretora.</p>
        <p className="mt-3 break-all rounded-lg bg-ice/60 p-3 font-mono text-sm text-n1">{link}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <CopyButton text={link} label="Copiar link" className="btn-primary" />
          <CopyButton text={message} label="Copiar mensagem pronta" />
        </div>
        <p className="mt-3 text-xs text-muted">
          Você só vê a nota, os controles e as provas de um cliente depois que ele autorizar o compartilhamento na tela de cadastro ou no painel dele.
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Clientes indicados", clients.length],
          ["Diagnóstico concluído", done],
          ["Autorizaram você a ver", authorized],
          ["Prontos para responder", ready],
        ].map(([label, n]) => (
          <Card key={label as string}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-2 font-display text-4xl font-extrabold text-n1">{n}</p>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="text-lg font-bold text-n1">Clientes ({clients.length})</h2>
        {clients.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nenhum cliente ainda. Envie o seu link para começar.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 pr-3">Empresa</th>
                  <th className="py-2 pr-3">Etapa</th>
                  <th className="py-2 pr-3">Nota</th>
                  <th className="py-2 pr-3">Prontidão para o seguro</th>
                  <th className="py-2 pr-3">Provas</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ c, r }) => (
                  <tr key={c.org_id}>
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
                    <td className="py-3 pr-3">{r ? `${r.essentialsWithEvidence} de ${r.essentialsTotal}` : "—"}</td>
                    <td className="py-3 text-right">
                      {c.shared && (
                        <Link href={`/corretor/cliente/${c.org_id}`} aria-label={`Ver detalhes de ${c.domain ?? "empresa"}`} className="link text-xs">
                          Ver detalhes
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
    </div>
  );
}
