"use client";

import { useActionState, useState } from "react";
import { formatCnpj } from "@/lib/cnpj";
import { EMPLOYEE_RANGES, SECTORS } from "@/lib/validation/organization";
import { saveCompanyProfile, type ProfileState } from "./actions";


function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  return messages?.length ? <p id={id} className="mt-1 text-sm text-red-700">{messages[0]}</p> : null;
}

// aria-invalid + aria-describedby: the screen reader reads the error together with the field.
const errorProps = (name: string, messages?: string[]) =>
  messages?.length ? { "aria-invalid": true, "aria-describedby": `${name}-error` } : {};

export function CompanyForm({
  orgId,
  initial,
}: {
  orgId: string;
  initial: { name: string; cnpj: string; sector: string; employeesRange: string; domain: string };
}) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveCompanyProfile.bind(null, orgId), {});
  const [cnpj, setCnpj] = useState(formatCnpj(initial.cnpj));
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      <div>
        <label htmlFor="name" className="block text-sm font-semibold text-n1">Nome da empresa</label>
        <input id="name" name="name" defaultValue={initial.name} required maxLength={160} {...errorProps("name", fe.name)} className="field" />
        <FieldError id="name-error" messages={fe.name} />
      </div>
      <div>
        <label htmlFor="cnpj" className="block text-sm font-semibold text-n1">CNPJ <span className="font-normal text-muted">(opcional)</span></label>
        <input
          id="cnpj"
          name="cnpj"
          inputMode="numeric"
          value={cnpj}
          onChange={(e) => setCnpj(formatCnpj(e.target.value))}
          placeholder="00.000.000/0000-00"
          {...errorProps("cnpj", fe.cnpj)} className="field"
        />
        <FieldError id="cnpj-error" messages={fe.cnpj} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="sector" className="block text-sm font-semibold text-n1">Setor</label>
          <select id="sector" name="sector" defaultValue={initial.sector} {...errorProps("sector", fe.sector)} className="field">
            <option value="">Escolha</option>
            {SECTORS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <FieldError id="sector-error" messages={fe.sector} />
        </div>
        <div>
          <label htmlFor="employeesRange" className="block text-sm font-semibold text-n1">Funcionários</label>
          <select id="employeesRange" name="employeesRange" defaultValue={initial.employeesRange} {...errorProps("employeesRange", fe.employeesRange)} className="field">
            <option value="">Escolha</option>
            {EMPLOYEE_RANGES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <FieldError id="employeesRange-error" messages={fe.employeesRange} />
        </div>
      </div>
      <p className="text-xs text-muted">Domínio verificado: <b className="text-n1">{initial.domain}</b> (não muda por aqui).</p>

      {state.error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">Dados salvos.</p>}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary px-6"
      >
        {pending ? "Salvando…" : "Salvar dados"}
      </button>
    </form>
  );
}
