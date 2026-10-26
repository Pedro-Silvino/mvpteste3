import { redirect } from "next/navigation";
import { cache } from "react";
import { parseOverview } from "./partner-data";
import { createClient } from "./supabase/server";

// Everything the broker panel needs, loaded once per request. Redirects when there is no session, when the account is
// not a broker yet (-> registration) or when the broker was deactivated by the team.
export const requirePartner = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/entrar?next=/corretor");

  const { data, error } = await supabase.rpc("partner_overview");
  if (error || !data) {
    const { count } = await supabase.from("partner_members").select("partner_id", { count: "exact", head: true }).eq("user_id", user.id);
    redirect(count && count > 0 ? "/corretor/suspensa" : "/corretor/novo");
  }
  return { supabase, user, overview: parseOverview(data) };
});

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
