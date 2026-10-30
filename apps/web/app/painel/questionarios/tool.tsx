"use client";

import { useMemo, useState } from "react";
import { exportApprovedCsv, matchQuestions, type Match, type VaultItem } from "@/lib/questionnaire-matcher";
import type { ParsedQuestion } from "@/lib/questionnaire-parser";
import { Card } from "../ui";

const CONFIDENCE: Record<string, string> = {
  alta: "bg-green-100 text-green-800",
  media: "bg-amber-100 text-amber-800",
  baixa: "bg-red-100 text-red-800",
};
const CONFIDENCE_LABEL: Record<string, string> = { alta: "Boa correspondência", media: "Correspondência parcial", baixa: "Evidência antiga" };

export function QuestionnaireTool({ vault }: { vault: VaultItem[] }) {
  const [format, setFormat] = useState<"json" | "csv">("csv");
  const [content, setContent] = useState("");
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const matches: Match[] = useMemo(() => matchQuestions(questions, vault), [questions, vault]);

  async function parse() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/questionnaires/parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ format, content }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; questions?: ParsedQuestion[] };
    setBusy(false);
    if (!res.ok || !data.questions) return setError(data.error ?? "Não foi possível ler o questionário.");
    setQuestions(data.questions);
    setApproved(new Set());
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFormat(file.name.toLowerCase().endsWith(".json") ? "json" : "csv");
    setContent(await file.text());
  }

  function toggle(id: string) {
    setApproved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function approveAll() {
    setApproved(new Set(matches.filter((m) => m.status === "sugerida" && !m.stale).map((m) => m.questionId)));
  }

  function download() {
    const blob = new Blob(["﻿" + exportApprovedCsv(matches, approved)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `respostas-aprovadas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <Card className="max-w-3xl">
        <h2 className="text-lg font-bold text-n1">1. Traga as perguntas</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label htmlFor="q-format" className="text-sm font-semibold text-n1">Formato</label>
          <select id="q-format" value={format} onChange={(e) => setFormat(e.target.value as "json" | "csv")} className="field w-auto text-sm">
            <option value="csv">CSV (colunas id e pergunta)</option>
            <option value="json">JSON (lista de perguntas)</option>
          </select>
          <input type="file" accept=".csv,.json,text/csv,application/json" onChange={(e) => onFile(e.target.files?.[0])} className="text-sm" aria-label="Enviar arquivo de perguntas" />
        </div>
        <label htmlFor="q-content" className="mt-3 block text-sm font-semibold text-n1">Ou cole o conteúdo aqui</label>
        <textarea id="q-content" value={content} onChange={(e) => setContent(e.target.value)} rows={7} maxLength={200000} className="field font-mono text-xs" placeholder={"id;pergunta\nQ1;A empresa usa verificação em duas etapas?"} />
        <button type="button" onClick={parse} disabled={busy || content.trim() === ""} className="btn-primary mt-3 px-6">
          {busy ? "Lendo…" : "Ler perguntas"}
        </button>
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      </Card>

      {matches.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-n1">2. Revise e aprove ({approved.size} de {matches.length})</h2>
            <div className="flex gap-2">
              <button type="button" onClick={approveAll} className="btn-secondary px-4 text-sm">Aprovar boas correspondências</button>
              <button type="button" onClick={download} disabled={approved.size === 0} className="btn-primary px-4 text-sm">Baixar respostas aprovadas (CSV)</button>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            São sugestões, não respostas prontas: confira cada uma antes de aprovar. As declarações feitas a clientes e seguradoras são de responsabilidade da empresa.
          </p>
          <ul className="mt-4 divide-y divide-line">
            {matches.map((m) => (
              <li key={m.questionId} className="py-4">
                <p className="text-sm font-semibold text-n1"><span className="text-muted">{m.questionId}</span> · {m.text}</p>
                {m.status === "sugerida" && m.evidence ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm text-n3">{m.suggestedAnswer}</p>
                    <p className="break-all font-mono text-xs text-muted">SHA-256 {m.evidence.sha256}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {m.confidence && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CONFIDENCE[m.confidence]}`}>{CONFIDENCE_LABEL[m.confidence]}</span>}
                      <button type="button" onClick={() => toggle(m.questionId)} aria-pressed={approved.has(m.questionId)} className={approved.has(m.questionId) ? "btn-primary px-4 text-sm" : "btn-secondary px-4 text-sm"}>
                        {approved.has(m.questionId) ? "Aprovada ✓" : "Aprovar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted">
                    {m.status === "sem_evidencia" ? "Ainda não há evidência desse tipo no cofre. Guarde uma para poder responder." : "Não identificamos o assunto desta pergunta. Responda manualmente."}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
