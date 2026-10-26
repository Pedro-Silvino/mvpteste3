export const metadata = { title: "Acesso suspenso — Sentinela" };

export default function SuspensaPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-ice px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-n1">Acesso do corretor suspenso</h1>
        <p className="mt-2 text-muted">O painel desta corretora está desativado. Fale com a equipe DataDops para saber mais.</p>
      </div>
    </main>
  );
}
