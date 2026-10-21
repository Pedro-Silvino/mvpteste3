"use client";

import { useState } from "react";

// A plain link, so it works without JavaScript; the script only gives feedback while the signed URL is made.
export function DownloadButton() {
  const [busy, setBusy] = useState(false);
  return (
    <a
      href="/resultado/pdf"
      onClick={() => {
        setBusy(true);
        setTimeout(() => setBusy(false), 4000);
      }}
      aria-busy={busy}
      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal px-6 py-3.5 font-semibold text-white hover:bg-n3"
    >
      {busy ? "Preparando o PDF…" : "Baixar relatório em PDF"}
    </a>
  );
}
