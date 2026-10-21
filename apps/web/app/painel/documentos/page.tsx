import { getPainel } from "@/lib/painel-data";
import { Card, Icon, LockedCard, PageHeader } from "../ui";

export const metadata = { title: "Documentos — Sentinela" };

const KITS = [
  { name: "Política de segurança", text: "Regras de uso de computadores, senhas e dados, prontas para ajustar e aprovar." },
  { name: "Plano de incidente", text: "O que fazer, quem avisar e em quanto tempo se houver um ataque." },
  { name: "Designação do responsável", text: "Carta que nomeia quem cuida da segurança da empresa." },
];
const GUIDES = [
  { name: "Orientações para a TI", text: "Roteiro por controle para quem cuida dos computadores e do e-mail." },
  { name: "Coletor dos computadores", text: "Programa que a TI roda uma vez para conferir antivírus, atualizações e criptografia e atualizar as lacunas sozinho. Não pede senha de ninguém." },
  { name: "Acompanhamento mensal", text: "Nova verificação todo mês e aviso quando algum controle piora." },
];

function Item({ name, text, paid }: { name: string; text: string; paid: boolean }) {
  return (
    <article className="flex flex-col rounded-xl border border-line p-4">
      <div className="flex items-center gap-2 text-n3">
        <Icon name="kits" className="h-5 w-5" />
        <h3 className="font-bold text-n1">{name}</h3>
      </div>
      <p className="mt-2 flex-1 text-sm text-muted">{text}</p>
      <p className={`mt-3 text-xs font-semibold ${paid ? "text-amber-700" : "text-muted"}`}>
        {paid ? "Em preparação para você" : "Disponível nos planos pagos"}
      </p>
    </article>
  );
}

export default async function DocumentosPage() {
  const p = await getPainel();
  return (
    <div className="space-y-5">
      <PageHeader
        title="Documentos e orientações"
        subtitle="Modelos para ajustar e aprovar, orientações para a TI e o coletor que confere os computadores."
      />
      {!p.paid && (
        <LockedCard
          title="Kits de documentos, orientações e coletor"
          text="Tudo o que a empresa precisa para sair da lacuna: documentos prontos, roteiro para a TI e conferência automática. Liberado em qualquer plano pago."
        />
      )}
      <Card>
        <h2 className="text-lg font-bold text-n1">Kits de documentos</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {KITS.map((k) => (
            <Item key={k.name} {...k} paid={p.paid} />
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="text-lg font-bold text-n1">Orientações e acompanhamento</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {GUIDES.map((k) => (
            <Item key={k.name} {...k} paid={p.paid} />
          ))}
        </div>
      </Card>
    </div>
  );
}
