# HISTÓRICO — diário do projeto

Memória entre conversas. **Entrada nova sempre no topo.** Curto e objetivo.

## Modelo de entrada

```
## AAAA-MM-DD HH:MM — T0X <nome da tarefa>
- Feito: <o que ficou pronto, em 1–3 tópicos>
- Arquivos: <principais arquivos criados/alterados>
- Decisões: <se houver; detalhe em DECISOES.md>
- Testes: <o que foi testado e resultado>
- Próximo passo: <tarefa seguinte ou o que falta nesta>
- Bloqueios: <nenhum | o que depende do Pedro>
```

---

## 2026-09-24 16:40 — T00 Kit inicial (criado no chat do claude.ai)
- Feito: CLAUDE.md, PRODUTO.md, BASE12.json, TAREFAS.md, DECISOES.md, comandos /inicio /fim /tarefa, migração inicial do Supabase.
- Arquivos: `CLAUDE.md`, `docs/*`, `supabase/migrations/20260924000000_init.sql`, `supabase/tests/*`, `.claude/commands/*`, `.env.example`.
- Decisões: D01 a D10 (ver DECISOES.md).
- Testes: migração aplicada num Postgres 16 local com stubs de auth/storage; 16 testes de RLS passaram (usuário B não vê dados de A; anônimo bloqueado; cliente não altera plano nem nota; hash do token invisível; cliente não sobe relatório falso).
- Próximo passo: T01 Repositório e ferramentas.
- Bloqueios: nenhum.
