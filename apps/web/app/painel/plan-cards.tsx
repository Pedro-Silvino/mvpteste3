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
      else setError(r.needsAccount ? "Salve o diagnóstico com e-mail e senha para escolher um plano." : "Não conseguimos enviar o pedido. Tente de novo.");
    });
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        {PLANS.map((p) => {
          const current = p.id === currentPlan;
          const isPaid = (PAID_PLANS as readonly string[]).includes(p.id);
          const wanted = requested === p.id;
          return (
            <div
              key={p.id}
              className={`flex flex-col rounded-2xl border-2 p-5 ${current ? "border-teal bg-ice/60" : "border-line bg-white"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-n1">{p.name}</h3>
                {current && <span className="rounded-full bg-teal px-3 py-0.5 text-xs font-semibold text-white">Seu plano</span>}
                {!current && wanted && (
                  <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-800">Pedido enviado</span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted">{p.forWho}</p>
              <ul className="mt-3 flex-1 space-y-1.5 text-sm text-ink">
                {p.includes.map((i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="text-teal">✓</span>
                    {i}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm font-semibold text-n3">{isPaid ? "Proposta sob medida" : "Sem custo"}</p>
              {isPaid && !current && (
                <div className="mt-2">
                  {anonymous ? (
                    <Link href="/conta" className="text-sm font-semibold text-teal underline">
                      Criar conta para escolher
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => choose(p.id as PaidPlanId)}
                      disabled={pendingPlan !== null || wanted}
                      className="w-full rounded-xl bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-n3 disabled:opacity-60"
                    >
                      {pendingPlan === p.id ? "Enviando…" : wanted ? "Pedido enviado" : "Quero este plano"}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {requested && (
        <p role="status" className="mt-4 rounded-xl bg-ice px-4 py-3 text-sm text-n1">
          Pedido do plano <b>{PLANS.find((p) => p.id === requested)?.name}</b> recebido. A equipe DataDops fala com você pelo
          e-mail da conta e libera o acesso.
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
