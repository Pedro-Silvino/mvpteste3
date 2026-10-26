"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass, fieldClass, PasswordField } from "@/app/_components/password-field";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage, signupSchema } from "@/lib/validation/auth";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = signupSchema.safeParse({ email, password });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setLoading(true);
    const { data, error } = await createClient().auth.signUp({
      ...parsed.data,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/corretor/novo` },
    });
    setLoading(false);
    if (error) return setError(authErrorMessage(error.code, error.status));
    // With e-mail confirmation on there is no session yet: the link in the e-mail brings the person to step 2.
    if (!data.session) return setSentTo(parsed.data.email);
    router.replace("/corretor/novo");
    router.refresh();
  }

  if (sentTo) {
    return (
      <p role="status" className="mt-6 rounded-lg bg-ice px-4 py-3 text-sm text-n1">
        Enviamos um link de confirmação para <b>{sentTo}</b>. Clique nele para continuar o cadastro.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      <div>
        <label className="block text-sm font-medium text-n1" htmlFor="email">
          E-mail de trabalho
        </label>
        <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} placeholder="voce@corretora.com.br" />
      </div>
      <PasswordField id="password" value={password} onChange={setPassword} autoComplete="new-password" hint="Mínimo de 8 caracteres." />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className={buttonClass}>
        {loading ? "Criando acesso..." : "Continuar"}
      </button>
    </form>
  );
}
