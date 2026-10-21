"use client";

import { useActionState, useState } from "react";
import { createToken, type TokenState } from "./actions";

export function TokenForm({ orgId, ingestUrl }: { orgId: string; ingestUrl: string }) {
  const [state, action, pending] = useActionState<TokenState, FormData>(createToken.bind(null, orgId), {});
  const [copied, setCopied] = useState(false);
  const command = state.token
    ? `powershell -ExecutionPolicy Bypass -File .\\sentinela-agent.ps1 -Token ${state.token} -ApiUrl ${ingestUrl}`
    : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="label" className="block text-sm font-semibold text-n1">Nome do token</label>
          <input id="label" name="label" required maxLength={60} placeholder="Ex.: TI matriz" className="field text-sm" />
        </div>
        <button disabled={pending} className="btn-primary px-6">
          {pending ? "Gerando…" : "Gerar token"}
        </button>
      </form>
      {state.error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      {state.token && (
        <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Copie agora: este token não aparece de novo.</p>
          <p className="mt-1 text-xs text-amber-900">O Sentinela guarda só um código de verificação dele, nunca o token. Se perder, gere outro.</p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-n1 p-3 text-xs leading-relaxed text-ice">{command}</pre>
          <button type="button" onClick={copy} className="btn-dark mt-3">
            {copied ? "Copiado" : "Copiar comando"}
          </button>
        </div>
      )}
    </div>
  );
}
