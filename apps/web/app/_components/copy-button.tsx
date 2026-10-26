"use client";

import { useState } from "react";

// Copies a text to the clipboard and says so. Falls back to a visible message when the browser blocks it.
export function CopyButton({ text, label = "Copiar", className = "btn-secondary" }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2500);
  }
  return (
    <button type="button" onClick={copy} className={className}>
      <span role="status">{state === "copied" ? "Copiado" : state === "failed" ? "Copie manualmente" : label}</span>
    </button>
  );
}
