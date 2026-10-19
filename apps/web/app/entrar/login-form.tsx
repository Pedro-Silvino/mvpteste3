"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";

const emailSchema = z.email();
const codeSchema = z.string().regex(/^\d{6}$/);

const GENERIC_ERROR = "Não foi possível continuar agora. Tente de novo em alguns minutos.";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse(email.trim().toLowerCase());
    if (!parsed.success) return setError("Informe um e-mail válido.");
    setLoading(true);
    const { error } = await createClient().auth.signInWithOtp({
      email: parsed.data,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    // Supabase Auth applies its own rate limit to OTP e-mails.
    if (error) return setError(error.status === 429 ? "Muitas tentativas. Aguarde alguns minutos." : GENERIC_ERROR);
    setEmail(parsed.data);
    setStep("code");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!codeSchema.safeParse(code).success) return setError("O código tem 6 números.");
    setLoading(true);
    const { error } = await createClient().auth.verifyOtp({ email, token: code, type: "email" });
    setLoading(false);
    if (error) return setError("Código inválido ou expirado. Peça um novo.");
    router.replace(next);
    router.refresh();
  }

  const input = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-ink focus:border-teal focus:outline-none";
  const button =
    "mt-6 w-full rounded-lg bg-teal px-4 py-3 font-semibold text-white hover:bg-n3 disabled:opacity-60";

  if (step === "email") {
    return (
      <form onSubmit={sendCode} className="mt-6" noValidate>
        <label className="block text-sm font-medium text-n1" htmlFor="email">
          E-mail de trabalho
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={input}
          placeholder="voce@suaempresa.com.br"
        />
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={loading} className={button}>
          {loading ? "Enviando..." : "Receber código"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verifyCode} className="mt-6" noValidate>
      <p className="text-sm text-muted">
        Enviamos o código para <strong className="text-n1">{email}</strong>.
      </p>
      <label className="mt-4 block text-sm font-medium text-n1" htmlFor="code">
        Código de 6 dígitos
      </label>
      <input
        id="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        required
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        className={`${input} tracking-[0.5em]`}
      />
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={loading} className={button}>
        {loading ? "Conferindo..." : "Entrar"}
      </button>
      <button
        type="button"
        onClick={() => {
          setStep("email");
          setCode("");
          setError(null);
        }}
        className="mt-3 w-full text-sm text-teal hover:underline"
      >
        Usar outro e-mail ou pedir novo código
      </button>
    </form>
  );
}
