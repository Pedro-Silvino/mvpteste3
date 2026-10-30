"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ALLOWED_MIME, MAX_BYTES } from "@/lib/evidence-client";
import { isComplete, VENDOR_CONTROLS, VENDOR_OPTIONS, workerEvidenceUrl } from "@/lib/vendor";
import { submitVendorAssessment } from "./actions";

export function VendorForm({ token, workerBase }: { token: string; workerBase?: string }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const canAttach = workerEvidenceUrl(workerBase, token, "C01") !== null;

  async function attach(control: string, file: File | undefined) {
    if (!file) return;
    const url = workerEvidenceUrl(workerBase, token, control);
    if (!url) return setNotes((n) => ({ ...n, [control]: "O envio de provas não está disponível agora." }));
    if (file.size > MAX_BYTES) return setNotes((n) => ({ ...n, [control]: "O arquivo precisa ter até 10 MB." }));
    if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) return setNotes((n) => ({ ...n, [control]: "Envie PDF, PNG ou JPG." }));
    setNotes((n) => ({ ...n, [control]: "Enviando…" }));
    try {
      const res = await fetch(url, { method: "POST", body: file, headers: { "X-File-Name": file.name.slice(0, 120) } });
      if (!res.ok) throw new Error(String(res.status));
      setFiles((f) => ({ ...f, [control]: [...(f[control] ?? []), file.name] }));
      setNotes((n) => ({ ...n, [control]: "" }));
    } catch {
      setNotes((n) => ({ ...n, [control]: "Não foi possível enviar este arquivo. Confira o tipo e o tamanho e tente de novo." }));
    }
  }

  async function submit() {
    setError("");
    if (!isComplete(answers)) return setError("Responda todas as perguntas antes de enviar.");
    setSending(true);
    const r = await submitVendorAssessment(token, answers);
    setSending(false);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  const answered = VENDOR_CONTROLS.filter((c) => answers[c.id]).length;

  return (
    <form
      className="mt-6 space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {VENDOR_CONTROLS.map((c, i) => (
        <fieldset key={c.id} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
            {i + 1} de {VENDOR_CONTROLS.length} · {c.name}
          </legend>
          <p className="text-base font-semibold text-n1">{c.question}</p>
          {c.help && <p className="mt-1 text-sm text-muted">{c.help}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {VENDOR_OPTIONS.map((o) => (
              <label
                key={o.value}
                className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  answers[c.id] === o.value ? "border-n1 bg-n1 text-white" : "border-line bg-white text-n3 hover:bg-ice"
                }`}
              >
                <input type="radio" name={c.id} value={o.value} checked={answers[c.id] === o.value} onChange={() => setAnswers((a) => ({ ...a, [c.id]: o.value }))} className="sr-only" />
                {o.label}
              </label>
            ))}
          </div>
          {canAttach && (answers[c.id] === "sim" || answers[c.id] === "parcial") && (
            <div className="mt-3">
              <label htmlFor={`f-${c.id}`} className="block text-sm font-semibold text-n1">Anexar prova (PDF, PNG ou JPG, até 10 MB)</label>
              <input id={`f-${c.id}`} type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => { void attach(c.id, e.target.files?.[0]); e.target.value = ""; }} className="field text-sm" />
              {(files[c.id] ?? []).map((n) => (
                <p key={n} className="mt-1 text-xs text-green-800">Enviado: {n}</p>
              ))}
              {notes[c.id] && <p role="status" className="mt-1 text-xs text-red-700">{notes[c.id]}</p>}
            </div>
          )}
        </fieldset>
      ))}
      <p className="rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-900">
        Envie só a prova do controle, sem senhas nem dados pessoais. Estas respostas são declarações da sua empresa e ficam registradas com a data do envio.
      </p>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={sending} className="btn-primary w-full px-6 sm:w-auto">
        {sending ? "Enviando…" : `Enviar respostas (${answered} de ${VENDOR_CONTROLS.length})`}
      </button>
    </form>
  );
}
