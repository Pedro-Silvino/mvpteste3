export const metadata = { title: "Diagnóstico — Sentinela" };

// Placeholder until T04 (questionnaire).
export default function DiagnosticoPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-ice px-4 py-12">
      <div className="w-full max-w-xl rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-n1">Empresa cadastrada</h1>
        <p className="mt-2 text-muted">A checagem do site e do e-mail já está na fila. O questionário chega em breve.</p>
      </div>
    </main>
  );
}
