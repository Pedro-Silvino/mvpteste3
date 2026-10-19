"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass, fieldClass, PasswordField } from "@/app/_components/password-field";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage, signupSchema } from "@/lib/validation/auth";

export function AccountForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = signupSchema.safeParse({ email, password });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setLoading(true);
    const supabase = createClient();

    // Converts the anonymous session into a permanent account; same user id, so the
    // company, answers and terms acceptance stay attached. Needs "Confirm email" OFF
    // and "Allow manual linking" ON in the Supabase dashboard.
    const emailStep = await supabase.auth.updateUser({ email: parsed.data.email });
    if (emailStep.error) {
      setLoading(false);
      return setError(authErrorMessage(emailStep.error.code, emailStep.error.status));
    }
    const passwordStep = await supabase.auth.updateUser({ password: parsed.data.password });
    setLoading(false);
    if (passwordStep.error) {
      return setError(authErrorMessage(passwordStep.error.code, passwordStep.error.status));
    }
    router.replace("/diagnostico");
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
      <PasswordField
        id="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        hint="Mínimo de 8 caracteres."
      />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className={buttonClass}>
        {loading ? "Salvando..." : "Salvar e continuar"}
      </button>
    </form>
  );
}
