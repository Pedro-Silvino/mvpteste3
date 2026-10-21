"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Conferindo o e-mail do domínio",
  "Verificando o certificado e o site",
  "Calculando a sua nota",
  "Montando o seu relatório",
];

// Waiting screen while the worker builds the report. The ticking steps are visual feedback (the worker does
// not report partial progress); the last one keeps pulsing until the page is refreshed with the real result.
export function ProcessingScreen({ title = "Montando o seu relatório…" }: { title?: string }) {
  const [done, setDone] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDone((d) => Math.min(d + 1, STEPS.length - 1)), 1100);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-lg shadow-n3/10 sm:p-10">
      <div className="relative mx-auto grid h-24 w-24 place-items-center" aria-hidden>
        <span className="absolute inset-0 animate-ping rounded-full bg-sky/40" />
        <span className="absolute inset-2 rounded-full border-4 border-ice border-t-teal motion-safe:animate-spin" />
        <svg viewBox="0 0 24 24" className="relative h-8 w-8 text-n3" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" strokeLinejoin="round" />
          <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="mt-6 text-center text-2xl font-bold text-n1">{title}</h1>
      <p className="mt-1 text-center text-sm text-muted">Leva poucos segundos. A página atualiza sozinha.</p>

      <ol className="mt-7 space-y-3" aria-live="polite">
        {STEPS.map((s, i) => {
          const state = i < done ? "done" : i === done ? "active" : "todo";
          return (
            <li key={s} className={`flex items-center gap-3 text-sm transition-opacity duration-500 ${state === "todo" ? "opacity-40" : "opacity-100"}`}>
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors duration-500 ${
                  state === "done" ? "bg-teal-strong text-white" : state === "active" ? "bg-ice text-teal-strong motion-safe:animate-pulse" : "bg-line text-muted"
                }`}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span className={state === "active" ? "font-semibold text-n1" : "text-ink"}>{s}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
