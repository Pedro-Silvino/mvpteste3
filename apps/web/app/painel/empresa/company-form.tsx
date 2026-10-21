"use client";

import { useActionState, useState } from "react";
import { formatCnpj } from "@/lib/cnpj";
import { EMPLOYEE_RANGES, SECTORS } from "@/lib/validation/organization";
import { saveCompanyProfile, type ProfileState } from "./actions";

const input =
  "mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-ink outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/20";

function FieldError({ messages }: { messages?: string[] }) {
  return messages?.length ? <p className="mt-1 text-sm text-red-700">{messages[0]}</p> : null;
}

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
        <input id="name" name="name" defaultValue={initial.name} required maxLength={160} className={input} />
        <FieldError messages={fe.name} />
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
          className={input}
        />
        <FieldError messages={fe.cnpj} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="sector" className="block text-sm font-semibold text-n1">Setor</label>
          <select id="sector" name="sector" defaultValue={initial.sector} className={input}>
            <option value="">Escolha</option>
            {SECTORS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <FieldError messages={fe.sector} />
        </div>
        <div>
          <label htmlFor="employeesRange" className="block text-sm font-semibold text-n1">Funcionários</label>
          <select id="employeesRange" name="employeesRange" defaultValue={initial.employeesRange} className={input}>
            <option value="">Escolha</option>
            {EMPLOYEE_RANGES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <FieldError messages={fe.employeesRange} />
        </div>
      </div>
      <p className="text-xs text-muted">Domínio verificado: <b className="text-n1">{initial.domain}</b> (não muda por aqui).</p>

      {state.error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">Dados salvos.</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-teal px-6 py-3 text-sm font-semibold text-white transition hover:bg-n3 disabled:opacity-60"
      >
        {pending ? "Salvando…" : "Salvar dados"}
      </button>
    </form>
  );
}
