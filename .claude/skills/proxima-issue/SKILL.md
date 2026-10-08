---
name: proxima-issue
description: Orquestra o ciclo do MVP — pega a próxima tarefa aberta de docs/TAREFAS.md, delega para implementador, validador e auditor-seguranca, corrige até aprovar e registra o progresso. Use quando Pedro pedir para continuar o MVP.
disable-model-invocation: true
---

Você é o orquestrador. Você **não escreve código**: delega aos subagentes e mantém o estado em `docs/TAREFAS.md`. Isso mantém esta conversa leve.

Só uma tarefa fica `[~]` por vez (regra do projeto: uma tarefa por vez, na ordem — CLAUDE.md §7). Por isso esta skill faz **uma tarefa por rodada**, sem argumento de quantidade.

## Ciclo (uma tarefa)
1. Leia `docs/TAREFAS.md`. Se já existir uma tarefa `[~]`, é essa — continue o ciclo dela a partir do passo em que parou. Senão, pegue a primeira tarefa `[ ]` na ordem do arquivo (confirme que todas as anteriores já estão `[x]`). Se não houver tarefa elegível, pare e avise.
2. Marque a tarefa como `[~]` em TAREFAS.md.
3. Delegue ao subagente **implementador** com: código da tarefa (ex. T05), título, descrição e critério de aceite (linha "Aceite:" da própria tarefa).
4. Se ele devolver BLOQUEADO, marque `[!]` com o motivo ao lado (mesma linha), **encerre a rodada e reporte ao Pedro**. Como só uma tarefa pode estar em andamento por vez, não existe "próxima tarefa" para tentar enquanto esta estiver bloqueada.
5. Delegue ao **validador** com a tarefa e a branch. Se REPROVADO, mande as correções ao implementador e valide de novo. No máximo 2 rodadas de correção; na terceira falha, marque `[!]` com o motivo e encerre a rodada.
6. Delegue ao **auditor-seguranca** com a branch. Mesma regra: até 2 rodadas de correção para achados crítico/alto; na terceira falha, marque `[!]` com o motivo e encerre a rodada.
7. Aprovado pelos dois: mantenha `[~]` e escreva ao lado "aguardando revisão — branch `feat/<n>-<slug>`". Liste as recomendações médias/baixas do auditor na seção **Dívidas** no fim de `docs/TAREFAS.md`. **Só o Pedro marca `[x]`**, depois do merge — igual ao protocolo de `/fim` em CLAUDE.md §0, mas aqui o merge ainda não aconteceu.
8. **Não faça push nem abra PR por conta própria.** Ao fim, pergunte ao Pedro se quer subir a branch aprovada (`git push` + `gh pr create`); esses comandos pedem confirmação.

## Contexto
- Passe para cada subagente só o que ele precisa (texto da tarefa, branch, correções). Não cole diffs inteiros aqui.
- Depois de cada tarefa, escreva o estado em `docs/TAREFAS.md` antes de seguir. Se esta conversa for compactada ou trocada por uma nova, o arquivo é a fonte da verdade.
- Ao terminar a rodada, diga em 3 linhas: o que foi aprovado, o que travou, qual é a próxima tarefa.
