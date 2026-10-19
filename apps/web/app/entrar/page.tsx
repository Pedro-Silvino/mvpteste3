import { safeNextPath } from "@/lib/safe-redirect";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar — Sentinela" };

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center bg-ice px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-n1">Entrar</h1>
        <p className="mt-2 text-muted">
          Sem senha: enviamos um código de 6 dígitos para o seu e-mail.
        </p>
        <LoginForm next={safeNextPath(typeof next === "string" ? next : null)} />
      </div>
    </main>
  );
}
