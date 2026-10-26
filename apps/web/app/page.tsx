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
          Você recebe uma nota de maturidade e vê a quais tipos de ataque a empresa está exposta.
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <Link href="/comecar" className="btn-primary px-6 text-base hover:bg-sky hover:text-n1">
            Fazer o diagnóstico gratuito
          </Link>
          <Link href="/entrar" className="font-semibold text-sky hover:underline">
            Já tenho conta
          </Link>
          <Link href="/corretores" className="font-semibold text-sky hover:underline">
            Sou corretor
          </Link>
        </div>
      </div>
    </main>
  );
}
