import Link from "next/link";

export const metadata = {
  title: "Para corretores — Sentinela",
  description: "Indique clientes, acompanhe o diagnóstico de segurança de cada um e veja quem já tem as provas que a seguradora costuma pedir.",
};

const STEPS = [
  ["Cadastre a corretora", "Em dois passos, sem custo. Você recebe um link de indicação só seu."],
  ["O cliente faz o diagnóstico gratuito", "Leva cerca de 15 minutos. Ele pode autorizar você a acompanhar o resultado."],
  ["Ele guarda as provas", "Prints e arquivos que comprovam cada controle, com data e código de verificação."],
  ["Você vê quem está pronto", "Um painel mostra, cliente a cliente, se os controles essenciais estão em dia e comprovados."],
] as const;

export default function CorretoresPage() {
  return (
    <main className="flex flex-1 flex-col bg-n1 text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-sky">Sentinela · Para corretores</p>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">Saiba quais clientes estão prontos para o questionário de ciberseguro.</h1>
        <p className="max-w-xl text-lg text-ice">
          Indique o diagnóstico gratuito aos seus clientes e acompanhe, num só painel, como está cada um nos controles que as seguradoras mais perguntam.
        </p>
        <ol className="space-y-4">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="flex gap-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-bold text-sky">{i + 1}</span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="block text-sm text-ice">{text}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <Link href="/corretor/cadastro" className="btn-primary px-6 text-base hover:bg-sky hover:text-n1">
            Cadastrar minha corretora
          </Link>
          <Link href="/entrar?next=/corretor" className="font-semibold text-sky hover:underline">
            Já tenho acesso
          </Link>
        </div>
        <p className="text-xs text-ice/70">
          O cliente decide o que compartilha com você e pode retirar a autorização quando quiser. A DataDops não é corretora nem seguradora, e o
          painel não garante aceitação ou indenização por seguradora.
        </p>
      </div>
    </main>
  );
}
