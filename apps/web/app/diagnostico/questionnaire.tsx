"use client";

import { useState, useTransition } from "react";
import { firstUnansweredIndex, type Step } from "@/lib/questionnaire";
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
  const [pending, startTransition] = useTransition();

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const progress = Math.round(((index + 1) / steps.length) * 100);

  function choose(value: string) {
    setError(null);
    const previous = answers;
    setAnswers({ ...answers, [step.id]: value });
    startTransition(async () => {
      const saved = await saveAnswer({ assessmentId, questionId: step.id, value });
      if (!saved.ok) {
        setAnswers(previous);
        setError("Não conseguimos salvar essa resposta. Tente de novo.");
        return;
      }
      if (!isLast) {
        setIndex(index + 1);
        return;
      }
      const sent = await submitAssessment(assessmentId);
      if (sent && !sent.ok) setError("Não conseguimos enviar o diagnóstico. Tente de novo.");
    });
  }

  return (
    <div className="w-full max-w-xl rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>Pergunta {index + 1} de {steps.length}</span>
        <span>{step.title}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-ice" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-teal transition-all" style={{ width: `${progress}%` }} />
      </div>

      <h1 className="mt-6 text-xl font-bold text-n1">{step.question}</h1>
      {step.help && <p className="mt-2 text-sm text-muted">{step.help}</p>}

      <div className="mt-6 grid gap-3" role="radiogroup" aria-label={step.question}>
        {step.options.map((o) => {
          const selected = answers[step.id] === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={pending}
              onClick={() => choose(o.value)}
              className={`rounded-lg border px-4 py-3 text-left font-medium disabled:opacity-60 ${
                selected ? "border-teal bg-ice text-n1" : "border-line text-ink hover:border-teal"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          disabled={index === 0 || pending}
          onClick={() => setIndex(index - 1)}
          className="text-sm text-teal underline disabled:opacity-40"
        >
          Voltar
        </button>
        {answers[step.id] && !isLast && (
          <button type="button" onClick={() => setIndex(index + 1)} className="text-sm text-teal underline">
            Próxima
          </button>
        )}
      </div>
    </div>
  );
}
