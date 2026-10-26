"use client";

import { useActionState } from "react";
import { PARTNER_KINDS } from "@/lib/validation/partner";
import { registerPartner, type PartnerFormState } from "./actions";

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  return messages?.length ? (
    <p id={id} className="mt-1 text-sm text-red-700">
      {messages[0]}
    </p>
  ) : null;
}

export function PartnerForm() {
  const [state, action, pending] = useActionState<PartnerFormState, FormData>(registerPartner, {});
  const v = state.values ?? {};
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="mt-6 space-y-5" noValidate>
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-n1">Nome da corretora</label>
        <input id="name" name="name" defaultValue={v.name} required maxLength={120} aria-invalid={fe.name ? true : undefined} aria-describedby={fe.name ? "name-error" : undefined} className="field" />
        <FieldError id="name-error" messages={fe.name} />
      </div>
      <div>
        <label htmlFor="kind" className="block text-sm font-medium text-n1">Tipo</label>
        <select id="kind" name="kind" defaultValue={v.kind ?? "corretor"} className="field">
          {PARTNER_KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
        <FieldError id="kind-error" messages={fe.kind} />
      </div>
      <div>
        <label htmlFor="susep" className="block text-sm font-medium text-n1">
          Registro na SUSEP <span className="font-normal text-muted">(opcional)</span>
        </label>
        <input id="susep" name="susep" defaultValue={v.susep} inputMode="numeric" aria-invalid={fe.susep ? true : undefined} aria-describedby={fe.susep ? "susep-error" : "susep-hint"} className="field" />
        <p id="susep-hint" className="mt-1 text-xs text-muted">A DataDops não é corretora nem seguradora. O número ajuda a equipe a confirmar o seu cadastro.</p>
        <FieldError id="susep-error" messages={fe.susep} />
      </div>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full text-base">
        {pending ? "Cadastrando..." : "Criar painel do corretor"}
      </button>
    </form>
  );
}
