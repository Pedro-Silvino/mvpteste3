"use client";

import { useState } from "react";

// A plain link, so it works without JavaScript; the script only gives feedback while the signed URL is made.
export function DownloadButton({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <a
      href="/resultado/pdf"
      onClick={() => {
        setBusy(true);
        setTimeout(() => setBusy(false), 4000);
      }}
      aria-busy={busy}
      className={`inline-flex items-center gap-2 rounded-xl bg-teal font-semibold text-white transition hover:bg-n3 ${
        compact ? "px-4 py-2.5 text-sm" : "mt-6 px-6 py-3.5"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {busy ? "Preparando o PDF…" : "Baixar relatório"}
    </a>
  );
}
