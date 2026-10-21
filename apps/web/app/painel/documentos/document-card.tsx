"use client";

import { useActionState } from "react";
import { requestDocument, approveDocument, type DocState } from "./actions";

type Doc = { id: string; version: number; approved_at: string | null; created_at: string };

const input =
  "mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/20";

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
            <a href={`/painel/documentos/arquivo?id=${latest.id}`} className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-n3">
              Baixar PDF
            </a>
            {!latest.approved_at && (
              <form action={approveDocument}>
                <input type="hidden" name="documentId" value={latest.id} />
                <button className="rounded-lg border border-teal px-3 py-1.5 text-xs font-semibold text-teal hover:bg-ice">Aprovar</button>
              </form>
            )}
          </div>
        </div>
      )}

      <form action={action} className="mt-3 space-y-2">
        {needsResponsible && (
          <div>
            <label className="block text-xs font-semibold text-n1" htmlFor={`resp-${kind}`}>Nome do responsável</label>
            <input id={`resp-${kind}`} name="responsavel" maxLength={120} required placeholder="Ex.: Maria Souza" className={input} />
          </div>
        )}
        <button
          disabled={busy}
          className="w-full rounded-xl bg-n3 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-n1 disabled:opacity-60"
        >
          {busy ? "Gerando…" : latest ? "Gerar nova versão" : "Gerar documento"}
        </button>
        {state.error && <p role="alert" className="text-xs text-red-700">{state.error}</p>}
      </form>
    </article>
  );
}
