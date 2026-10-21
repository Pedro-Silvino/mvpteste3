"use client";

import { useRef, useState } from "react";
import { firstUnansweredIndex, firstUnsavedIndex, type Step } from "@/lib/questionnaire";
import { saveAnswer, submitAssessment } from "./actions";

export function Questionnaire({
  assessmentId,
  steps,
  initialAnswers,
}: {
  assessmentId: string;
  steps: Step[];
  initialAnswers: Record<string, string>;
}) {
  const [answers, setAnswers] = useState(initialAnswers);
  const [index, setIndex] = useState(() => Math.min(firstUnansweredIndex(steps, initialAnswers), steps.length - 1));
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Saves run one after another in the background, so the next question opens instantly
  // and the final submit only goes after every answer is stored.
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));
  // Questions whose latest save failed. The submit only goes when this is empty.
  const failed = useRef(new Set<string>());

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const done = Object.keys(answers).filter((id) => steps.some((s) => s.id === id)).length;
  const progress = Math.round((done / steps.length) * 100);

  function choose(value: string) {
    if (sending) return;
    setError(null);
    setAnswers((a) => ({ ...a, [step.id]: value }));
    const questionId = step.id;
    queue.current = queue.current.then(async () => {
      const saved = await saveAnswer({ assessmentId, questionId, value });
      if (saved.ok) failed.current.delete(questionId);
      else {
        failed.current.add(questionId);
        setError("Não conseguimos salvar uma resposta. Confira a conexão e responda de novo.");
        setAnswers((a) => {
          const rest = { ...a };
          delete rest[questionId];
          return rest;
        });
      }
      return saved.ok;
    });

    if (!isLast) {
      setIndex(index + 1);
      return;
    }
    setSending(true);
    void queue.current.then(async () => {
      const unsaved = firstUnsavedIndex(steps, failed.current);
      if (unsaved !== -1) {
        setSending(false);
        setIndex(unsaved);
        setError("Esta resposta não foi salva. Responda de novo para enviar o diagnóstico.");
        return;
      }
      const sent = await submitAssessment(assessmentId);
      if (sent && !sent.ok) {
        setError("Não conseguimos enviar o diagnóstico. Tente de novo.");
        setSending(false);
      }
    });
  }

  return (
    <div className="w-full max-w-xl">
      <div className="mb-4 flex items-center justify-between text-sm font-medium text-n3">
        <span>
          {index + 1} <span className="text-muted">de {steps.length}</span>
        </span>
        <span className="rounded-full bg-white px-3 py-1 text-xs text-n3 shadow-sm">{step.title}</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-white"
        role="progressbar"
        aria-label="Progresso do diagnóstico"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-teal-strong transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div key={step.id} className="mt-6 rounded-3xl bg-white p-6 shadow-lg shadow-n3/10 sm:p-9">
        <h1 className="text-2xl font-bold leading-snug text-n1">{step.question}</h1>
        {step.help && <p className="mt-3 text-sm leading-relaxed text-muted">{step.help}</p>}

        <div className="mt-7 grid gap-3" role="radiogroup" aria-label={step.question}>
          {step.options.map((o) => {
            const selected = answers[step.id] === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={sending}
                onClick={() => choose(o.value)}
                className={`group flex items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left text-base font-semibold transition disabled:opacity-60 ${
                  selected
                    ? "border-teal bg-ice text-n1"
                    : "border-line text-n1 hover:border-teal hover:bg-ice/60 active:scale-[0.99]"
                } ${o.value === "nao_sei" ? "text-muted" : ""}`}
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${
                    selected ? "border-teal bg-teal-strong" : "border-line group-hover:border-teal"
                  }`}
                >
                  {selected && <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
                {o.label}
              </button>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {sending && <p className="mt-5 text-sm text-muted">Enviando suas respostas…</p>}
      </div>

      <div className="mt-4 flex items-center justify-between px-1 text-sm">
        <button
          type="button"
          disabled={index === 0 || sending}
          onClick={() => setIndex(index - 1)}
          className="font-medium text-n3 hover:text-teal-strong disabled:invisible"
        >
          ← Voltar
        </button>
        {answers[step.id] && !isLast && (
          <button type="button" onClick={() => setIndex(index + 1)} className="font-medium text-n3 hover:text-teal-strong">
            Pular para a próxima →
          </button>
        )}
      </div>
    </div>
  );
}
