import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PartnerForm } from "./partner-form";

export const metadata = { title: "Dados da corretora — Sentinela" };

export default async function NovoCorretorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/corretor/cadastro");
  const { count } = await supabase.from("partner_members").select("partner_id", { count: "exact", head: true }).eq("user_id", user.id);
  if (count && count > 0) redirect("/corretor");

  return (
    <main className="flex flex-1 items-center justify-center bg-ice px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-n1">Dados da corretora</h1>
        <p className="mt-2 text-muted">Passo 2 de 2. Depois você recebe o seu link de indicação e o painel dos clientes.</p>
        <PartnerForm />
      </div>
    </main>
  );
}
