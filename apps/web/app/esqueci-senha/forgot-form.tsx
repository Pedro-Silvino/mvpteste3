"use client";

import { useState } from "react";
import { buttonClass, fieldClass } from "@/app/_components/password-field";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage, emailOnlySchema } from "@/lib/validation/auth";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = emailOnlySchema.safeParse({ email });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setLoading(true);
    const { error } = await createClient().auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
    });
    setLoading(false);
    // Rate limit is the only error worth showing: anything else would reveal if the e-mail exists.
    if (error?.status === 429) return setError(authErrorMessage(error.code, error.status));
    setSent(true);
  }

  if (sent) {
    return (
      <p role="status" className="mt-6 text-n1">
        Se este e-mail tiver conta, enviamos o link agora. Confira também a caixa de spam.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6" noValidate>
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
      />
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className={buttonClass}>
        {loading ? "Enviando..." : "Enviar link"}
      </button>
    </form>
  );
}
