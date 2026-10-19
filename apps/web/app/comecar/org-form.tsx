"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createOrganization, type FormState } from "./actions";

const input = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-ink focus:border-teal focus:outline-none";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-sm text-red-700">{messages[0]}</p>;
}

export function OrgForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createOrganization, {});
  const v = state.values ?? {};
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="mt-6 space-y-5" noValidate>
      <div>
        <label htmlFor="domain" className="block text-sm font-medium text-n1">Site ou domínio do e-mail da empresa</label>
        <input id="domain" name="domain" defaultValue={v.domain} placeholder="suaempresa.com.br" required className={input} />
        <p className="mt-1 text-xs text-muted">Usamos só para checar o e-mail e o site (consultas públicas).</p>
        <FieldError messages={fe.domain} />
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" name="acceptTerms" className="mt-1 h-4 w-4 accent-teal" required />
          <span>
            Li e aceito os <Link href="/termos" target="_blank" className="text-teal underline">Termos de uso</Link> e o{" "}
            <Link href="/privacidade" target="_blank" className="text-teal underline">Aviso de privacidade</Link>, e autorizo
            a DataDops a fazer consultas públicas (DNS, certificado e cabeçalhos do site) no domínio informado.
          </span>
        </label>
        <FieldError messages={fe.acceptTerms} />
      </div>

      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-teal px-4 py-3 font-semibold text-white hover:bg-n3 disabled:opacity-60"
      >
        {pending ? "Cadastrando..." : "Começar diagnóstico"}
      </button>
    </form>
  );
}
