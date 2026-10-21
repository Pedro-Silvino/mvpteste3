"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { requestPlan } from "./actions";

const BENEFITS = [
  "Passo a passo para corrigir cada risco, em linguagem simples",
  "Coletor que confere os computadores da empresa sem pedir senha",
  "Acompanhamento mensal e aviso quando alguma coisa piora",
  "Relatório completo, com evidências e a relação com o questionário da seguradora",
];

export function Offer({ orgId, anonymous, requested }: { orgId: string; anonymous: boolean; requested: boolean }) {
  const [done, setDone] = useState(requested);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function ask() {
    setError(null);
    start(async () => {
      const r = await requestPlan(orgId);
      if (r.ok) setDone(true);
      else
        setError(
          r.needsAccount ? "Salve o diagnóstico com e-mail e senha primeiro." : "Não conseguimos enviar o pedido. Tente de novo.",
        );
    });
  }

  return (
    <section className="rounded-3xl bg-n1 p-6 text-white shadow-lg shadow-n3/20 sm:p-9">
      <p className="text-sm font-semibold uppercase tracking-wide text-sky">Próximo passo</p>
      <h2 className="mt-2 text-2xl font-bold leading-snug">Quer resolver esses riscos?</h2>
      <p className="mt-2 text-ice">O relatório mostra onde estão os problemas. Dentro do Sentinela você recebe como resolver:</p>
      <ul className="mt-4 space-y-2">
        {BENEFITS.map((b) => (
          <li key={b} className="flex gap-3 text-sm text-ice">
            <span aria-hidden className="mt-0.5 text-sky">✓</span>
            {b}
          </li>
        ))}
      </ul>

      {done ? (
        <p role="status" className="mt-6 rounded-xl bg-white/10 px-4 py-3 text-sm">
          Pedido recebido. A equipe DataDops vai falar com você pelo e-mail da sua conta.
        </p>
      ) : anonymous ? (
        <div className="mt-6">
          <Link
            href="/conta"
            className="inline-block rounded-xl bg-teal px-6 py-3.5 font-semibold text-white hover:bg-sky hover:text-n1"
          >
            Criar conta para receber a proposta
          </Link>
          <p className="mt-2 text-xs text-ice/80">Precisamos de um e-mail para responder. Leva 10 segundos.</p>
        </div>
      ) : (
        <div className="mt-6">
          <button
            type="button"
            onClick={ask}
            disabled={pending}
            className="rounded-xl bg-teal px-6 py-3.5 font-semibold text-white hover:bg-sky hover:text-n1 disabled:opacity-60"
          >
            {pending ? "Enviando…" : "Quero receber a proposta"}
          </button>
          <p className="mt-2 text-xs text-ice/80">Proposta sob medida para o tamanho da sua empresa. Sem compromisso.</p>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-300">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
