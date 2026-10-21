import { opportunities, type Level, type Threat } from "@/lib/threats";

const LEVEL_CHIP: Record<Level, string> = {
  Alto: "bg-red-100 text-red-800",
  Médio: "bg-amber-100 text-amber-800",
  Baixo: "bg-green-100 text-green-800",
  "Sem dado": "bg-slate-100 text-slate-600",
};
const LEVEL_BAR: Record<Level, string> = {
  Alto: "border-l-red-500",
  Médio: "border-l-amber-500",
  Baixo: "border-l-green-600",
  "Sem dado": "border-l-slate-300",
};
const card = "rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6";

// Shows WHICH KIND of attack the company is exposed to, what it could cost, and what it gains by fixing.
// It never names a control or a fix: that is the paid part.
export function ThreatSection({ threats }: { threats: Threat[] }) {
  return (
    <>
      <section className={card}>
        <h2 className="text-lg font-bold text-n1">Tipos de ataque e prejuízo possível</h2>
        <p className="mt-1 text-sm text-muted">O que as suas respostas e a checagem pública apontam, do mais ao menos exposto.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {threats.map((t) => (
            <article key={t.id} className={`rounded-xl border border-line border-l-4 p-4 ${LEVEL_BAR[t.level]}`}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold leading-snug text-n1">{t.name}</h3>
                <span className={`shrink-0 rounded-full px-3 py-0.5 text-xs font-semibold ${LEVEL_CHIP[t.level]}`}>
                  {t.level === "Sem dado" ? "Sem dado" : `Exposição ${t.level.toLowerCase()}`}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink">
                <span className="font-semibold text-n3">Como acontece: </span>
                {t.how}
              </p>
              <p className="mt-1.5 text-sm text-ink">
                <span className="font-semibold text-n3">Prejuízo possível: </span>
                {t.loss}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold text-n1">O que a sua empresa ganha ao corrigir</h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {opportunities().map((o) => (
            <li key={o} className="flex gap-3 rounded-xl bg-ice/50 p-4 text-sm text-ink">
              <span aria-hidden className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal text-xs font-bold text-white">
                ↑
              </span>
              {o}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
