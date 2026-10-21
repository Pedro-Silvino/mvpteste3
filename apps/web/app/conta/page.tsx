import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountForm } from "./account-form";

export const metadata = { title: "Salvar meu diagnóstico — Sentinela" };

export default async function ContaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/comecar");
  if (!user.is_anonymous) redirect("/painel");

  return (
    <main className="flex flex-1 items-center justify-center bg-ice px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-n1">Salve o seu diagnóstico</h1>
        <p className="mt-2 text-muted">
          Crie e-mail e senha para voltar depois e receber o relatório. Leva 10 segundos.
        </p>
        <AccountForm />
      </div>
    </main>
  );
}
