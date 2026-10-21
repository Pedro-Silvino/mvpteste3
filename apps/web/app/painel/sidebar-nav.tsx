"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./ui";

const ITEMS = [
  { href: "/painel", label: "Visão geral", icon: "home" },
  { href: "/painel/riscos", label: "Riscos", icon: "shield" },
  { href: "/painel/relatorio", label: "Relatório", icon: "report" },
  { href: "/painel/planos", label: "Planos", icon: "plans" },
  { href: "/painel/documentos", label: "Documentos", icon: "kits" },
  { href: "/painel/respostas", label: "Respostas", icon: "answers" },
  { href: "/painel/empresa", label: "Empresa", icon: "building" },
  { href: "/painel/sos", label: "SOS", icon: "alert" },
] as const;

export function SidebarNav({ variant }: { variant: "side" | "top" }) {
  const path = usePathname();
  const active = (href: string) => (href === "/painel" ? path === "/painel" : path.startsWith(href));

  if (variant === "top") {
    return (
      <nav aria-label="Painel" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:hidden">
        {ITEMS.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active(i.href) ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
              active(i.href) ? "bg-n1 text-white" : "bg-white text-n3 hover:bg-ice"
            }`}
          >
            <Icon name={i.icon} className="h-4 w-4" />
            {i.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label="Painel" className="mt-8 space-y-1">
      {ITEMS.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={active(i.href) ? "page" : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
            active(i.href) ? "bg-white/10 text-white shadow-inner" : "text-ice/70 hover:bg-white/5 hover:text-white"
          }`}
        >
          <Icon name={i.icon} />
          {i.label}
          {active(i.href) && <span aria-hidden className="ml-auto h-1.5 w-1.5 rounded-full bg-sky" />}
        </Link>
      ))}
    </nav>
  );
}
