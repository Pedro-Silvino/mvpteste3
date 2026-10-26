import { Card } from "../ui";
import { grantShare, revokeShare } from "./share-actions";

// Shown only when the company came from a broker's link. The owner decides whether that broker can see the results.
export function PartnerShareCard({ orgId, partnerName, shared }: { orgId: string; partnerName: string; shared: boolean }) {
  return (
    <Card className="mt-5 max-w-2xl">
      <h2 className="text-lg font-bold text-n1">Corretora que indicou a sua empresa</h2>
      <p className="mt-1 text-sm text-muted">
        <b className="text-n1">{partnerName}</b>{" "}
        {shared
          ? "pode ver a sua nota, o resultado de cada controle e o nome, a data e o código das provas que você enviar. Não vê senhas, lista de funcionários nem o conteúdo dos arquivos."
          : "só sabe que você começou o diagnóstico. Para ela acompanhar o seu resultado e as suas provas, autorize abaixo."}
      </p>
      <form action={shared ? revokeShare : grantShare} className="mt-4">
        <input type="hidden" name="orgId" value={orgId} />
        <button className={shared ? "btn-secondary" : "btn-primary"}>{shared ? "Retirar a autorização" : `Autorizar ${partnerName}`}</button>
      </form>
    </Card>
  );
}
