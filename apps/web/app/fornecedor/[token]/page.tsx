import type { SupabaseClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isVendorToken } from "@/lib/vendor";
import { VendorForm } from "./form";

// The link carries a credential: never indexed and never sent as a referrer.
export const metadata: Metadata = {
  title: "Questionário de segurança — Sentinela",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Assessment = { id: string; status: string; vendor_name: string; org_name: string; expires_at: string };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col bg-ice/40">
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-teal-strong">Sentinela · DataDops</p>
        {children}
      </div>
    </main>
  );
}

export default async function FornecedorPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let assessment: Assessment | null = null;
  if (isVendorToken(token)) {
    const supabase = (await createClient()) as unknown as SupabaseClient;
    const { data } = await supabase.rpc("vendor_get_assessment", { p_token: token });
    assessment = (data as Assessment | null) ?? null;
  }

  if (!assessment) {
    return (
      <Shell>
        <h1 className="mt-4 text-2xl font-bold text-n1">Link inválido ou expirado</h1>
        <p className="mt-2 text-muted">Peça à empresa que enviou o convite para gerar um novo link.</p>
      </Shell>
    );
  }

  if (assessment.status === "enviada") {
    return (
      <Shell>
        <h1 className="mt-4 text-2xl font-bold text-n1">Recebemos as suas respostas</h1>
        <p className="mt-2 text-muted">
          Obrigado, {assessment.vendor_name}. {assessment.org_name} foi avisada. As respostas e as provas enviadas ficam registradas com a data de hoje.
        </p>
        <section className="mt-8 rounded-2xl bg-n1 p-6 text-white sm:p-8">
          <h2 className="text-xl font-bold">E a segurança da sua própria empresa?</h2>
          <p className="mt-2 text-ice">
            Em cerca de 15 minutos você recebe uma nota de maturidade em segurança, com 12 perguntas em linguagem simples e uma checagem automática do seu site e do seu e-mail. É gratuito.
          </p>
          <Link href="/comecar" className="btn-primary mt-5 inline-block px-6 hover:bg-sky hover:text-n1">
            Fazer o meu diagnóstico gratuito
          </Link>
        </section>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="mt-4 text-2xl font-bold text-n1 sm:text-3xl">Questionário de segurança</h1>
      <p className="mt-2 text-muted">
        {assessment.org_name} pediu que {assessment.vendor_name} responda a 12 perguntas sobre os cuidados de segurança da empresa. Leva cerca de 10 minutos. Se puder, anexe uma prova (um print ou PDF) em cada resposta &ldquo;Sim&rdquo;: respostas comprovadas pesam mais na nota.
      </p>
      <VendorForm token={token} workerBase={process.env.NEXT_PUBLIC_WORKER_URL} />
    </Shell>
  );
}
