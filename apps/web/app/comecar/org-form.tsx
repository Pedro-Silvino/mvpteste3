"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createOrganization, type FormState } from "./actions";

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p id={id} className="mt-1 text-sm text-red-700">
      {messages[0]}
    </p>
  );
}

export function OrgForm({ partnerName }: { partnerName?: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createOrganization, {});
  const v = state.values ?? {};
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="mt-6 space-y-5" noValidate>
      <div>
        <label htmlFor="domain" className="block text-sm font-medium text-n1">Site ou domínio do e-mail da empresa</label>
        <input
          id="domain"
          name="domain"
          defaultValue={v.domain}
          placeholder="suaempresa.com.br"
          required
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={fe.domain ? true : undefined}
          aria-describedby={fe.domain ? "domain-hint domain-error" : "domain-hint"}
          className="field"
        />
        <p id="domain-hint" className="mt-1 text-xs text-muted">Usamos só para checar o e-mail e o site (consultas públicas).</p>
        <FieldError id="domain-error" messages={fe.domain} />
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            name="acceptTerms"
            className="mt-1 h-4 w-4 accent-teal-strong"
            required
            aria-invalid={fe.acceptTerms ? true : undefined}
            aria-describedby={fe.acceptTerms ? "terms-error" : undefined}
          />
          <span>
            Li e aceito os <Link href="/termos" target="_blank" className="text-teal-strong underline">Termos de uso</Link> e o{" "}
            <Link href="/privacidade" target="_blank" className="text-teal-strong underline">Aviso de privacidade</Link>, e autorizo
            a DataDops a fazer consultas públicas (DNS, certificado e cabeçalhos do site) no domínio informado.
          </span>
        </label>
        <FieldError id="terms-error" messages={fe.acceptTerms} />
      </div>

      {partnerName && (
        <div className="rounded-lg bg-ice/60 p-4">
          <label className="flex items-start gap-3 text-sm text-ink">
            <input type="checkbox" name="sharePartner" className="mt-1 h-4 w-4 accent-teal-strong" />
            <span>
              Você chegou por indicação de <b>{partnerName}</b>. Autorizo a {partnerName} a ver a nota, o resultado dos controles e as
              provas que eu enviar (não vê senhas, nem lista de funcionários). Posso retirar a autorização a qualquer momento, no painel.
            </span>
          </label>
          <p className="mt-2 text-xs text-muted">Opcional. Sem marcar, a corretora só sabe que você começou o diagnóstico.</p>
        </div>
      )}

      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn-primary w-full text-base">
        {pending ? "Cadastrando..." : "Começar diagnóstico"}
      </button>
    </form>
  );
}
