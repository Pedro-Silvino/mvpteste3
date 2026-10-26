import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizePartnerCode, PARTNER_COOKIE } from "@/lib/partner";
import { createClient } from "@/lib/supabase/server";
import { OrgForm } from "./org-form";

export const metadata = { title: "Sua empresa — Sentinela" };

export default async function ComecarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Visitors without a session see the form straight away; the session is created on submit.
  if (user) {
    const { count } = await supabase
      .from("memberships")
      .select("org_id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (count && count > 0) redirect("/painel");
    // A broker's own account goes to the broker panel, not to a new diagnostic.
    const { count: asPartner } = await supabase.from("partner_members").select("partner_id", { count: "exact", head: true }).eq("user_id", user.id);
    if (asPartner && asPartner > 0) redirect("/corretor");
  }

  // Referral link (?p=CODE, kept in a cookie): the visitor is told who referred them and can authorize sharing.
  const code = normalizePartnerCode((await cookies()).get(PARTNER_COOKIE)?.value);
  const { data: partnerName } = code ? await supabase.rpc("partner_name_by_code", { p_code: code }) : { data: null };

  return (
    <main className="flex flex-1 items-center justify-center bg-ice px-4 py-12">
      <div className="w-full max-w-xl rounded-2xl border border-line bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-n1">Sobre a sua empresa</h1>
        <p className="mt-2 text-muted">
          Leva 10 segundos. Sem cadastro: você só cria e-mail e senha no final, para salvar o resultado.
        </p>
        <OrgForm partnerName={partnerName} />
      </div>
    </main>
  );
}
