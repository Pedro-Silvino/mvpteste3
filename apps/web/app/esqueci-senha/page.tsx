import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Recuperar senha — Sentinela" };

export default function EsqueciSenhaPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-ice px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-n1">Recuperar senha</h1>
        <p className="mt-2 text-muted">Enviamos um link para você criar uma nova senha.</p>
        <ForgotForm />
        <p className="mt-6 text-center text-sm">
          <Link href="/entrar" className="link">
            Voltar para entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
