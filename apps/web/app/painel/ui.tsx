import type { ReactNode } from "react";

export const CHIP: Record<string, string> = {
  atende: "bg-green-100 text-green-800",
  parcial: "bg-amber-100 text-amber-800",
  nao_atende: "bg-red-100 text-red-800",
  sem_dado: "bg-slate-100 text-slate-600",
};

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6 ${className}`}>{children}</section>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-n1 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function LockedCard({ title, text, href = "/painel/planos", cta = "Ver os planos" }: { title: string; text: string; href?: string; cta?: string }) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-n1 p-6 text-white shadow-sm sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-teal/25 blur-2xl" />
      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-sky">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 018 0v3" />
          </svg>
          Nos planos pagos
        </span>
        <h2 className="mt-3 text-xl font-bold">{title}</h2>
        <p className="mt-2 max-w-xl text-sm text-ice">{text}</p>
        <a href={href} className="btn-primary mt-5 hover:bg-sky hover:text-n1">
          {cta}
        </a>
      </div>
    </section>
  );
}

const ICONS: Record<string, ReactNode> = {
  home: <path d="M3 11l9-8 9 8M5 10v10h14V10" strokeLinejoin="round" />,
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" strokeLinejoin="round" />
      <path d="M12 8v4m0 3h.01" strokeLinecap="round" />
    </>
  ),
  report: (
    <>
      <path d="M6 3h9l4 4v14H6z" strokeLinejoin="round" />
      <path d="M14 3v5h5M9 13h7M9 17h5" strokeLinecap="round" />
    </>
  ),
  plans: (
    <>
      <path d="M12 3l9 5-9 5-9-5 9-5z" strokeLinejoin="round" />
      <path d="M3 13l9 5 9-5M3 17.5l9 5 9-5" strokeLinejoin="round" />
    </>
  ),
  kits: (
    <>
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" strokeLinejoin="round" />
      <path d="M12 11v5m-2.5-2.5h5" strokeLinecap="round" />
    </>
  ),
  answers: (
    <>
      <path d="M4 5h16v11H9l-5 4V5z" strokeLinejoin="round" />
      <path d="M8 9h8M8 12h5" strokeLinecap="round" />
    </>
  ),
  building: (
    <>
      <path d="M4 21V6l8-3 8 3v15M9 21v-5h6v5" strokeLinejoin="round" />
      <path d="M9 9h.01M12 9h.01M15 9h.01M9 12h.01M12 12h.01M15 12h.01" strokeLinecap="round" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3l10 18H2L12 3z" strokeLinejoin="round" />
      <path d="M12 10v5m0 3h.01" strokeLinecap="round" />
    </>
  ),
  evidence: (
    <>
      <path d="M21 12.5l-8.5 8.5a5 5 0 01-7-7L14 5.5a3.5 3.5 0 015 5l-8.5 8.5a2 2 0 01-3-3L15 8.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  agent: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" strokeLinecap="round" />
    </>
  ),
  check: <path d="M5 12l5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />,
};

export function Icon({ name, className = "h-5 w-5" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}
