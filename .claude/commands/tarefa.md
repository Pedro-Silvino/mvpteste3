Executar a tarefa $ARGUMENTS do `docs/TAREFAS.md` (se vazio, a próxima tarefa aberta).

1. Leia a tarefa e os critérios de aceite. Leia as seções do `docs/PRODUTO.md` e do `docs/BASE12.json` que ela usa.
2. Marque `[~]` na tarefa.
3. Mostre o plano em até 5 tópicos e comece.
4. Escreva os testes junto com o código.
5. Rode os testes e o lint. Se mexeu em banco ou permissão, rode `supabase/tests/01_rls_test.sql` num Postgres local.
6. Revise o checklist de segurança do CLAUDE.md §4 para o que foi alterado.
7. Ao terminar: marque `[x]`, registre no `docs/HISTORICO.md`, faça commit.
8. Diga ao Pedro em até 5 tópicos o que ficou pronto e como testar.
9. Se já foram concluídas 3 tarefas nesta conversa, rode o protocolo `/fim`.
