"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ALLOWED_MIME, MAX_BYTES, safeFileName } from "@/lib/evidence-client";
import { createClient } from "@/lib/supabase/client";
import { sha256Hex, VAULT_CATEGORIES, VAULT_CATEGORY_LABEL } from "@/lib/vault";

export function VaultUploader({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<(typeof VAULT_CATEGORIES)[number]>("politica");
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function fail(msg: string) {
    setState("error");
    setMessage(msg);
  }

  async function send() {
    const file = fileRef.current?.files?.[0];
    if (title.trim().length < 3) return fail("Dê um nome para a evidência (pelo menos 3 letras).");
    if (!file) return fail("Escolha um arquivo para enviar.");
    if (file.size > MAX_BYTES) return fail("O arquivo precisa ter até 10 MB.");
    if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) return fail("Envie PDF, PNG ou JPG.");

    setState("sending");
    setMessage("");
    const sha256 = await sha256Hex(new Uint8Array(await file.arrayBuffer()));
    const path = `${orgId}/vault/${crypto.randomUUID().slice(0, 8)}-${safeFileName(file.name)}`;
    const { error } = await createClient().storage.from("evidence").upload(path, file, { contentType: file.type, upsert: false });
    if (error) return fail("Não conseguimos enviar o arquivo. Confira o seu plano e tente de novo.");

    const res = await fetch("/api/vault", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path, sha256, title: title.trim(), category }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return fail(data.error ?? "Não foi possível guardar a evidência.");
    if (fileRef.current) fileRef.current.value = "";
    setTitle("");
    setState("ok");
    setMessage("Evidência guardada no cofre com o código de verificação (SHA-256). Ela não pode ser alterada nem apagada.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="v-title" className="block text-sm font-semibold text-n1">Nome da evidência</label>
        <input id="v-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} className="field text-sm" placeholder="Ex.: Política de backup 2026" />
      </div>
      <div>
        <label htmlFor="v-cat" className="block text-sm font-semibold text-n1">Do que se trata?</label>
        <select id="v-cat" value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="field text-sm">
          {VAULT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{VAULT_CATEGORY_LABEL[c]}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="v-file" className="block text-sm font-semibold text-n1">Arquivo (PDF, PNG ou JPG, até 10 MB)</label>
        <input id="v-file" ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg" className="field text-sm" />
      </div>
      <p className="rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-900">
        O cofre guarda o arquivo como ele é e não deixa mudar nem apagar depois. Envie só a prova do controle, sem senhas nem dados pessoais.
      </p>
      <button type="button" onClick={send} disabled={state === "sending"} className="btn-primary px-6">
        {state === "sending" ? "Guardando…" : "Guardar no cofre"}
      </button>
      {message && (
        <p role={state === "error" ? "alert" : "status"} className={`rounded-lg px-4 py-3 text-sm ${state === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
