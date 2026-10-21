import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";

// Staff-only pages answer 404 to everyone else (they don't even reveal that the area exists).
// The database enforces the same rule (RLS + is_staff() inside the RPCs); this is only the front door.
export const requireStaff = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?next=/staff");
  const { data: profile } = await supabase.from("profiles").select("is_staff").eq("id", user.id).maybeSingle();
  if (!profile?.is_staff) notFound();
  return { supabase, user };
});
