import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "../database.types";
import { supabaseEnv } from "./env";

// Server client acting as the signed-in user (RLS applies). `headers` lets a server action
// forward the end user's IP so public.request_ip() records it instead of the server's.
export async function createClient(headers?: Record<string, string>) {
  // cookies() first: marks the route dynamic, so env is only read at request time.
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();
  return createServerClient<Database>(url, anonKey, {
    global: headers ? { headers } : undefined,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: the middleware refreshes the session instead.
        }
      },
    },
  });
}
