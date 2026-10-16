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

## 2026-10-16 10:40 — T02 Supabase
- Feito: `sentinela-mvp` (gcysfzzpiwospnmwkcar) com 2 migrações aplicadas e alinhadas; 17 tabelas com RLS; advisors sem ERROR (9 WARN intencionais, D12). Base do web consertada: ESLint via FlatCompat, scripts `typecheck`/`test` (vitest 4.1.11).
- Arquivos: `supabase/tests/run_local.sh` (novo), `apps/web/eslint.config.mjs`, `apps/web/package.json`, `.claude/agents/validador.md`, `CLAUDE.md`, `docs/DECISOES.md`.
- Decisões: D12. Teste de RLS roda no PostgreSQL 17 local, sem Docker: `bash supabase/tests/run_local.sh`.
- Testes: RLS 16/16 ok (todas as linhas "deve FALHAR" barradas; `update assessments set score` dá UPDATE 0). `pnpm lint`/`typecheck`/`build` ok; `pnpm test` falha com "No test files found" até a T03 (esperado). Worker: 1 passed.
- Próximo passo: T03 Login e cadastro (inclui virar staff após o 1º login do Pedro).
- Bloqueios: nenhum. Pendente do Pedro: remover a frase do Supabase em `autoMode.environment` (~/.claude/settings.json).

## 2026-09-24 17:15 — T01 Repositório e ferramentas
- Feito: `git init` + primeiro commit; monorepo pnpm (`apps/web` Next.js 15.5.26 + TS + Tailwind); `worker/` com uv + FastAPI (Python 3.12.14); Dependabot (npm, uv, github-actions).
- Arquivos: `pnpm-workspace.yaml`, `package.json` (raiz), `apps/web/*`, `worker/pyproject.toml`, `worker/app/main.py`, `worker/tests/test_health.py`, `.github/dependabot.yml`.
- Decisões: create-next-app instalou Next 16 por padrão; travado em 15.5.26 conforme stack do CLAUDE.md §2. Removidos AGENTS.md/CLAUDE.md que o Next 16 gera automaticamente (não fazem parte da convenção do projeto).
- Testes: `pnpm dev` sobe e `/` responde 200; `uv run pytest` no worker passa 1 teste (`/health`).
- Próximo passo: T02 Supabase (criar projeto `sentinela-mvp`, mostrar SQL da migração, aplicar após "ok", rodar advisors).
- Bloqueios: nenhum.

## 2026-09-24 16:40 — T00 Kit inicial (criado no chat do claude.ai)
- Feito: CLAUDE.md, PRODUTO.md, BASE12.json, TAREFAS.md, DECISOES.md, comandos /inicio /fim /tarefa, migração inicial do Supabase.
- Arquivos: `CLAUDE.md`, `docs/*`, `supabase/migrations/20260924000000_init.sql` (hoje `20260925142248_init.sql`, alinhada ao histórico do remoto), `supabase/tests/*`, `.claude/commands/*`, `.env.example`.
- Decisões: D01 a D10 (ver DECISOES.md).
- Testes: migração aplicada num Postgres 16 local com stubs de auth/storage; 16 testes de RLS passaram (usuário B não vê dados de A; anônimo bloqueado; cliente não altera plano nem nota; hash do token invisível; cliente não sobe relatório falso).
- Próximo passo: T01 Repositório e ferramentas.
- Bloqueios: nenhum.
