"use client";

import { useActionState } from "react";
import { openIncident, type SosState } from "./actions";

export function SosForm({ orgId }: { orgId: string }) {
  const [state, action, pending] = useActionState<SosState, FormData>(openIncident.bind(null, orgId), {});
  return (
    <form action={action} className="space-y-4">
      <label htmlFor="description" className="block text-sm font-semibold text-n1">
        O que aconteceu?
      </label>
      <textarea
        id="description"
        name="description"
        required
        minLength={5}
        maxLength={2000}
        rows={4}
        placeholder="Ex.: o computador do financeiro mostra uma tela pedindo resgate."
        className="field mt-0 py-3 focus:border-red-400"
      />
      <p className="text-xs text-muted">Não escreva senhas nem dados de clientes. A equipe pede o que precisar depois.</p>
      {state.error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      {state.ok && (
        <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          Chamado aberto. Ele já aparece para a equipe DataDops, que entra em contato pelo e-mail da conta. Enquanto isso, siga os primeiros passos ao lado.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "Abrindo…" : "Abrir chamado SOS"}
      </button>
    </form>
  );
}
