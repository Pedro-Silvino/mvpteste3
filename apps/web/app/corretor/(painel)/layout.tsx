import type { ReactNode } from "react";
import { signOut } from "@/app/auth/actions";
import { requirePartner } from "@/lib/partner-session";

export const metadata = { title: "Painel do corretor — Sentinela", robots: { index: false, follow: false } };

export default async function CorretorLayout({ children }: { children: ReactNode }) {
  const { overview } = await requirePartner();
  return (
    <div className="flex flex-1 flex-col bg-surface">
      <header className="bg-n1 text-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div>
            <p className="font-display text-lg font-extrabold tracking-wide">SENTINELA</p>
            <p className="text-xs text-sky">Painel do corretor · {overview.partner.name}</p>
          </div>
          <form action={signOut}>
            <button className="rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold hover:bg-white/10">Sair</button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-8 sm:py-10">
        {children}
        <p className="mt-10 text-center text-xs text-muted">
          Retrato do ambiente na data da coleta. Não substitui análise jurídica nem garante aceitação ou indenização por seguradora.
          As declarações feitas à seguradora são de responsabilidade da empresa. A DataDops não é corretora nem seguradora.
        </p>
      </main>
    </div>
  );
}
