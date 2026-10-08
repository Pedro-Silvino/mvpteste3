// Hook SessionStart (matcher "compact"): depois de uma compactação de contexto,
// injeta um resumo compacto do estado do MVP a partir de docs/TAREFAS.md
// (fonte da verdade), em vez do arquivo inteiro.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const raiz = process.env.CLAUDE_PROJECT_DIR || process.cwd();

let texto;
try {
  texto = readFileSync(join(raiz, "docs", "TAREFAS.md"), "utf8");
} catch {
  process.exit(0); // sem arquivo de tarefas: não injeta nada
}

const linhas = texto.split("\n");

const legenda = linhas.find((l) => l.startsWith("Legenda:")) ?? "";
const emAndamentoOuBloqueadas = linhas.filter((l) => /^- \[[~!]\]/.test(l));
const proximasAbertas = linhas
  .filter((l) => /^- \[ \] \*\*T\d{2}/.test(l))
  .slice(0, 3);

const inicioDivida = texto.indexOf("## Dívidas");
const divida = inicioDivida === -1 ? "" : texto.slice(inicioDivida).trim();

const partes = [
  "Resumo de docs/TAREFAS.md (fonte da verdade do MVP Sentinela; leia o arquivo completo se precisar de mais contexto).",
  legenda,
  "",
  "Em andamento / bloqueadas:",
  emAndamentoOuBloqueadas.length ? emAndamentoOuBloqueadas.join("\n") : "(nenhuma)",
  "",
  "Próximas tarefas abertas:",
  proximasAbertas.length ? proximasAbertas.join("\n") : "(nenhuma — backlog aberto vazio)",
];

if (divida) {
  partes.push("", divida);
}

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: partes.join("\n"),
    },
  })
);
