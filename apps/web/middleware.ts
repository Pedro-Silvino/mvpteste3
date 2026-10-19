import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./lib/database.types";
import { normalizePartnerCode, PARTNER_COOKIE, PARTNER_COOKIE_MAX_AGE } from "./lib/partner";
import { supabaseEnv } from "./lib/supabase/env";

// Need a session (anonymous counts). /comecar is public: it creates the anonymous session.
const NEEDS_SESSION = ["/diagnostico", "/conta"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = supabaseEnv();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getUser() validates the JWT with Supabase Auth (getSession() would trust the cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  let redirectTo: URL | null = null;

  if (!user && NEEDS_SESSION.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    redirectTo = new URL("/comecar", request.url);
  } else if (user && !user.is_anonymous && pathname === "/entrar") {
    // An anonymous visitor may still want to log into an existing account.
    redirectTo = new URL("/comecar", request.url);
  }

  const finalResponse = redirectTo ? NextResponse.redirect(redirectTo) : response;
  if (redirectTo) {
    for (const cookie of response.cookies.getAll()) finalResponse.cookies.set(cookie);
  }

  // Partner attribution: ?p=CODIGO kept for 30 days (last click wins).
  const partner = normalizePartnerCode(request.nextUrl.searchParams.get("p"));
  if (partner) {
    finalResponse.cookies.set(PARTNER_COOKIE, partner, {
      maxAge: PARTNER_COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  return finalResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
