import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido."));

// bcrypt (used by Supabase Auth) only reads the first 72 bytes.
const password = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .refine((p) => new TextEncoder().encode(p).length <= 72, "A senha é muito longa (máximo 72 caracteres).");

export const signupSchema = z.object({ email, password });

// Login accepts any non-empty password: the strength rule applies only when creating one.
export const loginSchema = z.object({ email, password: z.string().min(1, "Informe a senha.") });

export const emailOnlySchema = z.object({ email });
export const passwordOnlySchema = z.object({ password });

const GENERIC = "Não foi possível continuar agora. Tente de novo em alguns minutos.";

// Never echoes Supabase internals; `code` is AuthError.code, `status` the HTTP status.
export function authErrorMessage(code?: string, status?: number): string {
  if (code === "invalid_credentials") return "E-mail ou senha incorretos.";
  if (code === "email_exists" || code === "user_already_exists") {
    return "Este e-mail já tem conta. Entre com a sua senha.";
  }
  if (code === "weak_password") return "Senha fraca. Use pelo menos 8 caracteres e evite senhas comuns.";
  if (code === "same_password") return "Escolha uma senha diferente da anterior.";
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit" || status === 429) {
    return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  }
  return GENERIC;
}
