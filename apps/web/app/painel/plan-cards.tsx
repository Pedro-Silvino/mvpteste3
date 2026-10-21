"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { PAID_PLANS, PLANS, type PaidPlanId } from "@/lib/plans";
import { requestPlan } from "../resultado/actions";

export function PlanCards({
  orgId,
  currentPlan,
  requestedPlan,
  anonymous,
}: {
  orgId: string;
  currentPlan: string;
  requestedPlan: PaidPlanId | null;
  anonymous: boolean;
}) {
  const [requested, setRequested] = useState<PaidPlanId | null>(requestedPlan);
  const [error, setError] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [, start] = useTransition();

  function choose(plan: PaidPlanId) {
    setError(null);
    setPendingPlan(plan);
    start(async () => {
      const r = await requestPlan(orgId, plan);
      setPendingPlan(null);
      if (r.ok) setRequested(plan);
      else
        setError(
          r.needsAccount ? "Salve a sua conta com e-mail e senha para escolher um plano." : "Não conseguimos enviar o pedido. Tente de novo.",
        );
    });
  }

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        {PLANS.map((p) => {
          const current = p.id === currentPlan;
          const isPaid = (PAID_PLANS as readonly string[]).includes(p.id);
          const wanted = requested === p.id;
          return (
            <article
              key={p.id}
              className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition ${
                current ? "border-teal ring-2 ring-teal/30" : wanted ? "border-amber-300 ring-2 ring-amber-200" : "border-line hover:border-teal/60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-xl font-extrabold text-n1">{p.name}</h3>
                  <p className="mt-0.5 text-sm text-muted">{p.forWho}</p>
                </div>
                {current && <span className="shrink-0 rounded-full bg-teal-strong px-3 py-1 text-xs font-semibold text-white">Seu plano</span>}
                {!current && wanted && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Pedido enviado</span>
                )}
              </div>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-ink">
                {p.includes.map((i) => (
                  <li key={i} className="flex gap-2.5">
                    <span aria-hidden className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-ice text-[10px] font-bold text-teal-strong">
                      ✓
                    </span>
                    {i}
                  </li>
                ))}
              </ul>
              <div className="mt-6 border-t border-line pt-4">
                <p className="text-sm font-semibold text-n3">{isPaid ? "Proposta sob medida" : "Sem custo"}</p>
                {isPaid && !current && (
                  <div className="mt-3">
                    {anonymous ? (
                      <Link href="/conta" className="btn-secondary">
                        Criar conta para escolher
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => choose(p.id as PaidPlanId)}
                        disabled={pendingPlan !== null || wanted}
                        className="btn-primary w-full"
                      >
                        {pendingPlan === p.id ? "Enviando…" : wanted ? "Pedido enviado" : "Quero este plano"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {requested && (
        <p role="status" className="mt-4 rounded-xl bg-ice px-4 py-3 text-sm text-n1">
          Pedido do plano <b>{PLANS.find((p) => p.id === requested)?.name}</b> recebido. A equipe DataDops fala com você pelo e-mail
          da conta e libera o acesso.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
