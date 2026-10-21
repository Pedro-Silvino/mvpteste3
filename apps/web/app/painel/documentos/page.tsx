import { formatDateTime } from "@/lib/assessment-data";
import { getPainel } from "@/lib/painel-data";
import { createClient } from "@/lib/supabase/server";
import { AutoRefresh } from "../../resultado/auto-refresh";
import { Card, Icon, LockedCard, PageHeader } from "../ui";
import { DocumentCard } from "./document-card";

export const metadata = { title: "Documentos — Sentinela" };

const KITS = [
  { kind: "politica", name: "Política de segurança", text: "Regras de uso de computadores, senhas e dados, prontas para ajustar e aprovar.", needsResponsible: false },
  { kind: "plano_incidente", name: "Plano de incidente", text: "O que fazer, quem avisar e em quanto tempo se houver um ataque.", needsResponsible: false },
  { kind: "designacao", name: "Designação do responsável", text: "Carta que nomeia quem cuida da segurança da empresa.", needsResponsible: true },
];
const GUIDES = [
  { name: "Orientações para a TI", text: "Roteiro por controle para quem cuida dos computadores e do e-mail.", href: "/painel/riscos" },
  { name: "Coletor dos computadores", text: "Programa que a TI roda uma vez para conferir antivírus, atualizações e criptografia. Não pede senha de ninguém.", href: "/painel/agente" },
  { name: "Evidências", text: "Guarde prints e arquivos que provam cada controle, com data e identificação do arquivo.", href: "/painel/evidencias" },
];

export default async function DocumentosPage() {
  const p = await getPainel();
  const supabase = await createClient();

  const [{ data: docs }, { data: jobs }] = p.paid
    ? await Promise.all([
        supabase.from("documents").select("id, kind, version, approved_at, created_at").eq("org_id", p.org.id).order("version", { ascending: false }),
        supabase.from("jobs").select("payload").eq("org_id", p.org.id).eq("kind", "relatorio").in("status", ["pendente", "rodando"]),
      ])
    : [{ data: [] }, { data: [] }];

  const latest = new Map<string, NonNullable<typeof docs>[number]>();
  for (const d of docs ?? []) if (!latest.has(d.kind)) latest.set(d.kind, d);
  const generating = new Set((jobs ?? []).map((j) => (j.payload as { document?: string } | null)?.document));

  return (
    <div className="space-y-5">
      {generating.size > 0 && <AutoRefresh everyMs={2500} />}
      <PageHeader
        title="Documentos e orientações"
        subtitle="Modelos para ajustar e aprovar, orientações para a TI, o coletor que confere os computadores e as evidências de cada controle."
      />
      {!p.paid && (
        <LockedCard
          title="Kits de documentos, orientações e coletor"
          text="Tudo o que a empresa precisa para sair da lacuna: documentos prontos, roteiro para a TI, conferência automática e evidências. Liberado em qualquer plano pago."
        />
      )}

      <Card>
        <h2 className="text-lg font-bold text-n1">Kits de documentos</h2>
        <p className="mt-1 text-sm text-muted">
          Modelos-base com os dados da sua empresa. São marcados para revisão jurídica: ajuste ao que a empresa faz e aprove.
        </p>
        {p.paid ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {KITS.map((k) => {
              const d = latest.get(k.kind) ?? null;
              return (
                <DocumentCard
                  key={k.kind}
                  orgId={p.org.id}
                  {...k}
                  latest={d}
                  generating={generating.has(k.kind)}
                  date={d ? formatDateTime(d.created_at) : null}
                />
              );
            })}
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {KITS.map((k) => (
              <article key={k.kind} className="rounded-xl border border-line p-4 opacity-80">
                <div className="flex items-center gap-2 text-n3">
                  <Icon name="kits" className="h-5 w-5" />
                  <h3 className="font-bold text-n1">{k.name}</h3>
                </div>
                <p className="mt-2 text-sm text-muted">{k.text}</p>
                <p className="mt-3 text-xs font-semibold text-muted">Disponível nos planos pagos</p>
              </article>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-bold text-n1">Orientações e acompanhamento</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {GUIDES.map((g) => (
            <article key={g.name} className="flex flex-col rounded-xl border border-line p-4">
              <h3 className="font-bold text-n1">{g.name}</h3>
              <p className="mt-1 flex-1 text-sm text-muted">{g.text}</p>
              {p.paid ? (
                <a href={g.href} className="mt-3 text-sm font-semibold text-teal hover:underline">Abrir</a>
              ) : (
                <p className="mt-3 text-xs font-semibold text-muted">Disponível nos planos pagos</p>
              )}
            </article>
          ))}
        </div>
      </Card>
    </div>
  );
}
