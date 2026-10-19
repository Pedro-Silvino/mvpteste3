import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col bg-n1 text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-sky">Sentinela · DataDops</p>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
          Descubra em 15 minutos como está a segurança da sua empresa.
        </h1>
        <p className="max-w-xl text-lg text-ice">
          12 perguntas em linguagem simples e uma checagem automática do seu site e do seu e-mail.
          Você recebe uma nota de maturidade e um plano do que corrigir primeiro.
        </p>
        <div>
          <Link
            href="/entrar"
            className="inline-block rounded-lg bg-teal px-6 py-3 font-semibold text-white hover:bg-sky hover:text-n1"
          >
            Fazer o diagnóstico gratuito
          </Link>
        </div>
      </div>
    </main>
  );
}
