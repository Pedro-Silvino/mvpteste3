import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Cadastro de corretor — Sentinela" };

export default function CadastroCorretorPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-ice px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-n1">Cadastro de corretor</h1>
        <p className="mt-2 text-muted">Passo 1 de 2: crie o seu acesso. No passo seguinte você informa os dados da corretora.</p>
        <SignupForm />
        <p className="mt-6 text-center text-sm text-muted">
          Já tem acesso?{" "}
          <Link href="/entrar?next=/corretor" className="link">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
