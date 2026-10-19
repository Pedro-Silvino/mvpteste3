"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass, PasswordField } from "@/app/_components/password-field";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage, passwordOnlySchema } from "@/lib/validation/auth";

export function ResetForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = passwordOnlySchema.safeParse({ password });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password: parsed.data.password });
    setLoading(false);
    if (error) return setError(authErrorMessage(error.code, error.status));
    router.replace("/diagnostico");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6" noValidate>
      <PasswordField
        id="password"
        label="Nova senha"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        hint="Mínimo de 8 caracteres."
      />
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className={buttonClass}>
        {loading ? "Salvando..." : "Salvar nova senha"}
      </button>
    </form>
  );
}
