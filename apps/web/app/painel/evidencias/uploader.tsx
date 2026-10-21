"use client";

import { useRef, useState } from "react";
import { ALLOWED_MIME, buildStoragePath, MAX_BYTES } from "@/lib/evidence-client";
import { createClient } from "@/lib/supabase/client";
import { registerEvidence } from "./actions";

const input =
  "mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/20";

export function Uploader({ orgId, controls }: { orgId: string; controls: { id: string; name: string }[] }) {
  const [control, setControl] = useState(controls[0]?.id ?? "");
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function send() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) return fail("O arquivo precisa ter até 10 MB.");
    if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) return fail("Envie PDF, PNG ou JPG.");

    setState("sending");
    setMessage("");
    const path = buildStoragePath(orgId, control, crypto.randomUUID().slice(0, 8), file.name);
    const { error } = await createClient().storage.from("evidence").upload(path, file, { contentType: file.type, upsert: false });
    if (error) return fail("Não conseguimos enviar o arquivo. Confira o seu plano e tente de novo.");
    const r = await registerEvidence({ controlId: control, path, fileName: file.name.slice(0, 120) });
    if (!r.ok) return fail(r.error ?? "Não conseguimos registrar o arquivo.");
    if (fileRef.current) fileRef.current.value = "";
    setState("ok");
    setMessage("Arquivo guardado, com a data e o código de verificação (SHA-256).");
  }

  function fail(msg: string) {
    setState("error");
    setMessage(msg);
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="control" className="block text-sm font-semibold text-n1">Qual controle este arquivo comprova?</label>
        <select id="control" value={control} onChange={(e) => setControl(e.target.value)} className={input}>
          {controls.map((c) => (
            <option key={c.id} value={c.id}>{c.id} · {c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="file" className="block text-sm font-semibold text-n1">Arquivo (PDF, PNG ou JPG, até 10 MB)</label>
        <input id="file" ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg" className={input} />
      </div>
      <p className="rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-900">
        Envie só a prova do controle (um print da tela de backup, por exemplo). Não envie dados pessoais, senhas nem dados de clientes.
      </p>
      <button
        type="button"
        onClick={send}
        disabled={state === "sending"}
        className="rounded-xl bg-teal px-6 py-3 text-sm font-semibold text-white transition hover:bg-n3 disabled:opacity-60"
      >
        {state === "sending" ? "Enviando…" : "Enviar arquivo"}
      </button>
      {message && (
        <p role={state === "error" ? "alert" : "status"} className={`rounded-lg px-4 py-3 text-sm ${state === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
