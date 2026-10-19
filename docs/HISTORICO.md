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

## 2026-10-19 18:00 — T03 ajustada (D16: diagnóstico antes do cadastro)
- Feito: `/comecar` público (sessão anônima criada ao enviar o formulário); `/conta` converte em e-mail + senha (2 passos: e-mail, depois senha); `/entrar` por senha; `/esqueci-senha` + `/auth/callback` + `/redefinir-senha`; OTP removido.
- Testes: Vitest 25/25 (novo `lib/validation/auth.test.ts`); lint/typecheck/build ok de pasta limpa; smoke: `/diagnostico` e `/conta` sem sessão → `/comecar`, `/comecar` abre sem login, callback com `next=//evil.com` não vaza.
- Painel do Supabase (só o Pedro): Authentication → Sign In/Providers: ligar **Allow anonymous sign-ins** e **Allow manual linking**; no provedor Email: manter senha, desligar **Confirm email**, mínimo de senha 8; URL Configuration: adicionar `http://localhost:3000/auth/callback` em Redirect URLs.
- Ponto não verificado: com Confirm email desligado o `updateUser({email})` deve valer na hora, mas a doc do Supabase só descreve a conversão com verificação — testar `/conta` de verdade.
- Riscos aceitos: D17.

## 2026-10-19 14:00 — T03 Login e cadastro da empresa (em andamento)
- Feito: `/entrar` (e-mail + código OTP de 6 dígitos), `/comecar` (Zod, máscara e dígito de CNPJ, setor, faixa, aceite único cobrindo termos + privacidade + scan externo) via server action → `create_organization`; middleware (sessão, rotas protegidas, cookie `?p=` 30 dias httpOnly); layout com Archivo/Hanken e cores da marca; home; placeholders `/diagnostico`, `/termos`, `/privacidade`.
- Arquivos: `apps/web/middleware.ts`, `apps/web/lib/{cnpj,partner,safe-redirect,request}.ts`, `apps/web/lib/validation/organization.ts`, `apps/web/lib/supabase/*`, `apps/web/app/{entrar,comecar,diagnostico,termos,privacidade}/*`.
- Decisões: D13 (rate limit), D14 (CNPJ numérico), D15 (IP do aceite). Deps: @supabase/supabase-js 2.118.0, @supabase/ssr 0.12.7, zod 4.6.7.
- Testes: Vitest 19/19 (CNPJ, parceiro, open redirect, schema, IP, mensagens de erro); lint/typecheck/build ok a partir de `.next` limpo; smoke local: `/comecar` e `/diagnostico` → 307 `/entrar?next=`, cookie `snt_partner` gravado e `?p=<script>` ignorado. Regras de banco do aceite (parceiro, 3 aceites, job, B não vê A) cobertas pelo teste de RLS T1–T3/T8.
- Próximo passo: Pedro cria `apps/web/.env.local` e ajusta o template de e-mail OTP; testar ponta a ponta; virar staff. Em paralelo: T04.
- Bloqueios: `.env.local` (só Pedro tem as chaves); template "Magic Link" do Supabase precisa conter `{{ .Token }}` para enviar o código.

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
