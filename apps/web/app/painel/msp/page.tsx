import { redirect } from "next/navigation";

// O console fica em /corretor/msp: lá a sessão de corretor/MSP é validada e quem não tem empresa própria também entra
// (o layout de /painel exige uma empresa com diagnóstico). Este endereço só encaminha, e preserva o filtro.
export default async function PainelMspPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = new URLSearchParams();
  for (const key of ["nivel", "conta"]) {
    const v = params[key];
    if (typeof v === "string") q.set(key, v);
  }
  const s = q.toString();
  redirect(s ? `/corretor/msp?${s}` : "/corretor/msp");
}
