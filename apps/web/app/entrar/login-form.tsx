"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass, fieldClass, PasswordField } from "@/app/_components/password-field";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage, loginSchema } from "@/lib/validation/auth";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setLoading(true);
    const { error } = await createClient().auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) return setError(authErrorMessage(error.code, error.status));
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      <div>
        <label className="block text-sm font-medium text-n1" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={fieldClass}
          placeholder="voce@suaempresa.com.br"
        />
      </div>
      <PasswordField id="password" value={password} onChange={setPassword} autoComplete="current-password" />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className={buttonClass}>
        {loading ? "Entrando..." : "Entrar"}
      </button>
      <p className="pt-2 text-center text-sm text-muted">
        <Link href="/esqueci-senha" className="text-teal-strong hover:underline">
          Esqueci minha senha
        </Link>
        {" · "}
        <Link href="/comecar" className="text-teal-strong hover:underline">
          Fazer o diagnóstico
        </Link>
      </p>
    </form>
  );
}
