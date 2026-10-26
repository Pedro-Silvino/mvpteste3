import type { ReactNode } from "react";
import { getPainel } from "@/lib/painel-data";
import { planName } from "@/lib/plans";
import { ProcessingScreen } from "../_components/processing-screen";
import { AutoRefresh } from "../resultado/auto-refresh";
import { retryAssessment } from "./actions";
import { SidebarNav } from "./sidebar-nav";

export const metadata = { title: "Painel — Sentinela", robots: { index: false, follow: false } };

export default async function PainelLayout({ children }: { children: ReactNode }) {
  const p = await getPainel();

  // Right after the questionnaire the report is still being built: show the animation and refresh until ready.
  if (!p.ready) {
    return (
      <main className="flex flex-1 items-center justify-center bg-surface px-4 py-12">
        {!p.failed && <AutoRefresh everyMs={1500} />}
        {p.failed ? (
          <div className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-lg shadow-n3/10">
            <h1 className="text-2xl font-bold text-n1">Não conseguimos gerar o relatório</h1>
            <p className="mt-2 text-muted">As suas respostas estão salvas. Peça de novo; costuma resolver em segundos.</p>
            <form action={retryAssessment} className="mt-6">
              <input type="hidden" name="assessmentId" value={p.assessment.id} />
              <button className="btn-primary px-6">Tentar de novo</button>
            </form>
            <p className="mt-4 text-sm text-muted">
              Se continuar, fale com a equipe DataDops e informe o domínio{" "}
              <b className="text-n1">{p.org.domain ?? p.org.name}</b>.
            </p>
            {p.user.anonymous && (
              <p className="mt-4 text-sm text-muted">
                Para não perder o acesso,{" "}
                <a href="/conta" className="link">
                  salve a sua conta com e-mail e senha
                </a>
                .
              </p>
            )}
          </div>
        ) : (
          <ProcessingScreen />
        )}
      </main>
    );
  }

  return (
    <div className="flex flex-1 bg-surface lg:min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-n1 p-5 text-white lg:flex">
        <div>
          <p className="font-display text-lg font-extrabold tracking-wide">SENTINELA</p>
          <p className="text-xs text-sky">by DataDops</p>
        </div>
        <SidebarNav variant="side" />
        <div className="mt-auto space-y-3">
          <div className="rounded-xl bg-white/5 p-4">
            <p className="text-xs text-ice/70">Empresa</p>
            <p className="truncate text-sm font-semibold">{p.org.domain ?? p.org.name}</p>
            <p className="mt-3 text-xs text-ice/70">Plano</p>
            <p className="text-sm font-semibold text-sky">{planName(p.org.plan)}</p>
          </div>
          {p.user.anonymous && (
            <a href="/conta" className="btn-primary w-full hover:bg-sky hover:text-n1">
              Salvar minha conta
            </a>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-display text-base font-extrabold tracking-wide text-n1">SENTINELA</p>
              <p className="max-w-[12rem] truncate text-xs text-muted">{p.org.domain ?? p.org.name}</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-n3 shadow-sm">{planName(p.org.plan)}</span>
          </div>
          <SidebarNav variant="top" />
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
          {p.user.anonymous && (
            <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 lg:hidden">
              Este painel está só neste navegador.{" "}
              <a href="/conta" className="font-semibold underline">
                Salve com e-mail e senha
              </a>
              .
            </p>
          )}
          {children}
          <p className="mt-10 text-center text-xs text-muted">
            Retrato do ambiente na data da coleta. Não substitui análise jurídica nem garante aceitação ou indenização por
            seguradora. As declarações feitas à seguradora são de responsabilidade da empresa.
          </p>
        </main>
      </div>
    </div>
  );
}
