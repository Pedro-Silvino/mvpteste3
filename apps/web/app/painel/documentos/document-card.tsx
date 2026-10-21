"use client";

import { useActionState } from "react";
import { ConfirmButton } from "@/app/_components/confirm-button";
import { requestDocument, approveDocument, type DocState } from "./actions";

type Doc = { id: string; version: number; approved_at: string | null; created_at: string };

export function DocumentCard({
  orgId,
  kind,
  name,
  text,
  needsResponsible,
  latest,
  generating,
  date,
}: {
  orgId: string;
  kind: string;
  name: string;
  text: string;
  needsResponsible: boolean;
  latest: Doc | null;
  generating: boolean;
  date: string | null;
}) {
  const [state, action, pending] = useActionState<DocState, FormData>(requestDocument.bind(null, orgId, kind), {});
  const busy = pending || generating;

  return (
    <article className="flex flex-col rounded-xl border border-line p-4">
      <h3 className="font-bold text-n1">{name}</h3>
      <p className="mt-1 text-sm text-muted">{text}</p>

      {latest && (
        <div className="mt-3 rounded-lg bg-ice/60 p-3 text-sm">
          <p className="font-semibold text-n1">
            Versão {latest.version} {date ? `· ${date}` : ""}
          </p>
          <p className={`text-xs font-semibold ${latest.approved_at ? "text-green-700" : "text-amber-700"}`}>
            {latest.approved_at ? "Aprovada" : "Aguardando a sua aprovação"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <a href={`/painel/documentos/arquivo?id=${latest.id}`} aria-label={`Baixar PDF: ${name}, versão ${latest.version}`} className="btn-primary min-h-9 px-3 py-1.5 text-xs">
              Baixar PDF
            </a>
            {!latest.approved_at && (
              <form action={approveDocument}>
                <input type="hidden" name="documentId" value={latest.id} />
                <ConfirmButton
                  message={`Aprovar a versão ${latest.version} de "${name}"? A aprovação fica registrada com a sua conta e a data.`}
                  className="btn-secondary min-h-9 px-3 py-1.5 text-xs"
                >
                  Aprovar
                </ConfirmButton>
              </form>
            )}
          </div>
        </div>
      )}

      <form action={action} className="mt-3 space-y-2">
        {needsResponsible && (
          <div>
            <label className="block text-xs font-semibold text-n1" htmlFor={`resp-${kind}`}>Nome do responsável</label>
            <input id={`resp-${kind}`} name="responsavel" maxLength={120} required placeholder="Ex.: Maria Souza" className="field text-sm" />
          </div>
        )}
        <button
          disabled={busy}
          className="btn-dark w-full"
        >
          {busy ? "Gerando…" : latest ? "Gerar nova versão" : "Gerar documento"}
        </button>
        {state.error && <p role="alert" className="text-xs text-red-700">{state.error}</p>}
      </form>
    </article>
  );
}
