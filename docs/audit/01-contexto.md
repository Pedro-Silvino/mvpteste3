# 01 — Contexto (Fase 1 da auditoria, 2026-10-21)

Branch: `audit/melhorias-2026-10-21` (criada a partir de `master` limpo, commit `77926b0`).

## O produto em 8 linhas
- **Sentinela** (DataDops) faz um diagnóstico de segurança para PMEs: 16 perguntas em linguagem de dono + checagem pública do domínio (DNS, certificado, cabeçalhos HTTP).
- Usuário: dono ou responsável de TI de pequena/média empresa; depois, corretores e seguradoras leem o relatório. A equipe DataDops usa a área `/staff`.
- Gera nota de maturidade (0–100), tipos de ataque a que a empresa está exposta e PDF com a identidade DataDops (grátis: sem lacunas; pago: lacunas + como resolver).
- Planos pagos (sem preço, "proposta sob medida") liberam lacunas, documentos (política, plano de incidente, designação), evidências com SHA-256, coletor Windows e verificação mensal com alertas.
- Base de regras: `docs/BASE12.json` (12 controles), copiada para web e worker com teste de igualdade.

## Fluxos críticos
1. **Início do diagnóstico:** home → `/comecar` (só domínio + aceite) → sessão anônima → `create_organization` (empresa + aceites + job `scan_externo`).
2. **Questionário:** `/diagnostico` (16 telas, salva cada resposta) → `submit_assessment` → job `processar` → `/painel` (tela de espera até o PDF sair).
3. **Salvar conta e voltar:** `/conta` (anônimo → e-mail e senha), `/entrar`, `/esqueci-senha` → `/auth/callback` → `/redefinir-senha`.
4. **Plano pago:** `/painel/planos` → `request_plan` (alerta para a equipe) → staff ativa em `/staff/org/[id]` (`staff_set_plan`).
5. **Coleta e ingestão:** `/painel/agente` gera token → `sentinela-agent.ps1` → `POST /ingest` (worker) → avaliação `completo`.

## Stack e estrutura
| Parte | Tecnologia | Pasta |
|---|---|---|
| Portal | Next.js 15.5.26 (App Router), React 19, TypeScript, Tailwind 4, Zod 4 | `apps/web` |
| Banco/Auth/Storage | Supabase (Postgres + RLS, Auth com sessão anônima, buckets privados) | `supabase/migrations` |
| Worker | Python 3.12, FastAPI, httpx, dnspython, Jinja2, Playwright (PDF) | `worker/` |
| Coletor | PowerShell 5.1+ | `agent/` |

- Gerenciadores: `pnpm` (web), `uv` (worker). Sem CI de testes (só Dependabot em `.github/dependabot.yml`).
- Rotas web: 28 (ver saída do build abaixo). Rotas de arquivo (URL assinada 5 min): `/resultado/pdf`, `/painel/{relatorio,documentos,evidencias}/arquivo`.
- Worker: `GET /health`, `POST /ingest` (público, autenticado por token `snt_…`), loop de jobs (`scan_externo`, `processar`, `relatorio`, `mensal`) e agendador mensal em threads.
- Autenticação: Supabase Auth (anônima → e-mail/senha). Autorização: RLS + RPCs `security definer` (D06). Staff: `profiles.is_staff`.
- Integrações externas: Supabase, Resend (e-mail, opcional), Google Fonts (PDF), Asaas (futuro).
- Variáveis esperadas (`.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `TERMS_VERSION`, `WORKER_PUBLIC_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `MAIL_FROM`, `ASAAS_*`.
- Migrações: 2 aplicadas no remoto (`init`, `fix_security_definer_execute_grants`); 2 **não aplicadas** (`request_plan`, `features`) aguardando o ok do Pedro.

## Comandos reais
| Ação | Comando |
|---|---|
| Instalar | `pnpm install` (raiz) · `uv sync` (worker) |
| Dev | `pnpm dev` · `uv run uvicorn app.main:app` |
| Build | `pnpm --filter web build` |
| Lint / typecheck | `pnpm lint` · `pnpm typecheck` (em `apps/web`) |
| Testes | `pnpm test` (Vitest) · `uv run pytest` (worker) · `bash supabase/tests/run_local.sh` (RLS, precisa de Postgres 17 local) |

## Linha de base (antes de qualquer mudança)
| Verificação | Resultado |
|---|---|
| `pnpm test` (web) | ✅ 13 arquivos, **63/63** |
| `pnpm lint` | ✅ sem erros |
| `pnpm typecheck` | ✅ sem erros |
| `pnpm build` | ✅ 28 rotas; First Load JS compartilhado 102 kB; middleware 94,9 kB |
| `uv run pytest` (worker) | ✅ **111/111** (1 aviso de depreciação do Starlette) |
| `pnpm audit --prod` | ❌ **8 vulnerabilidades** (4 altas, 4 moderadas): `next <15.5.27` (2× cache poisoning), `postcss 8.4.31` via next (3), `source-map-js <1.2.2`, `sharp <0.35.5` |
| `pip-audit` | ⚠️ não executado: sem acesso a pypi.org nesta máquina (`Failed to fetch https://pypi.org/simple/pip-audit/`) |
| Testes de RLS (`supabase/tests`) | ⚠️ não executado: sem Postgres 17 local nesta sessão |

Nada estava quebrado na linha de base, além das vulnerabilidades de dependência.
