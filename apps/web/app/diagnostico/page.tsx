import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Diagnóstico — Sentinela" };

// Placeholder until T04 (questionnaire). The "save your result" step moves to the end of the
// questionnaire (before the PDF) when T04 lands.
export default async function DiagnosticoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex flex-1 items-center justify-center bg-ice px-4 py-12">
      <div className="w-full max-w-xl rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-n1">Empresa cadastrada</h1>
        <p className="mt-2 text-muted">A checagem do site e do e-mail já está na fila. O questionário chega em breve.</p>
        {user?.is_anonymous && (
          <Link
            href="/conta"
            className="mt-6 inline-block rounded-lg bg-teal px-5 py-3 font-semibold text-white hover:bg-n3"
          >
            Salvar meu diagnóstico (e-mail e senha)
          </Link>
        )}
      </div>
    </main>
  );
}
