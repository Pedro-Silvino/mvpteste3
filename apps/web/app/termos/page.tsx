export const metadata = { title: "Termos de uso — Sentinela" };

// Final text pending legal review (docs/TAREFAS.md, "Pendências do Pedro").
export default function TermosPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-bold text-n1">Termos de uso</h1>
      <p className="mt-4 text-muted">Versão {process.env.TERMS_VERSION ?? "1.0"} — texto final em revisão jurídica.</p>
    </main>
  );
}
