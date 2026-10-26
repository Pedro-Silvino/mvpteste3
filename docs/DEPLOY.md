# DEPLOY — Sentinela (T08)

Nada daqui foi executado ainda: é o roteiro para quando o Pedro mandar subir. Deploy e merge na `main` só com pedido explícito (CLAUDE.md §4.15).

## 0. Antes de qualquer deploy
- [ ] Aplicar no `sentinela-mvp` as migrações pendentes, **depois do "ok" do Pedro**: `20261021120000_request_plan.sql` e `20261022000000_features.sql`. Em seguida: rodar `get_advisors` (segurança) e `supabase gen types typescript --linked > apps/web/lib/database.types.ts`.
- [ ] `bash supabase/tests/run_local.sh` passando (RLS + funcionalidades).
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` no `apps/web` e `uv run pytest` no `worker/` passando.
- [ ] Ativar o plano de uma empresa de teste (`update organizations set plan = 'essencial' where id = ...`) só se for para testar a parte paga.

## 1. Supabase (painel, projeto `sentinela-mvp`, só o Pedro)
- Authentication → Sign In / Providers: **Allow anonymous sign-ins** e **Allow manual linking** ligados.
- Provedor E-mail: senha com mínimo de 8; **Confirm email** desligado (D16/D17: riscos aceitos, ver SEGURANCA.md).
- URL Configuration: `Site URL` = endereço de produção; Redirect URLs com `https://app.datadops.com.br/auth/callback` e `http://localhost:3000/auth/callback`.
- (Recomendado antes de abrir ao público) ligar captcha no Auth (Turnstile) para o login anônimo.

## 2. Worker (Railway ou Fly.io)
Imagem: `worker/Dockerfile` (base oficial do Playwright, usuário sem root). **Build ainda não testado** (sem Docker na máquina de desenvolvimento): o primeiro deploy é o teste.

Variáveis de ambiente do serviço:
| Variável | Valor |
|---|---|
| `SUPABASE_URL` | `https://gcysfzzpiwospnmwkcar.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service role (segredo do serviço, nunca no repositório) |
| `RESEND_API_KEY`, `MAIL_FROM` | opcionais: sem elas não há e-mail de alerta |
| `STAFF_ALERT_EMAIL` | opcional: quem da equipe recebe o e-mail de SOS (o alerta aparece em `/staff` de qualquer forma) |

Pontos de atenção:
- **Uma única instância.** O limite de 10 envios/hora do coletor e o agendador mensal rodam em memória; duas instâncias duplicariam o agendamento e dobrariam o limite. (Se precisar escalar, mover o limite para o banco e travar o agendador.)
- **Proxy na frente do worker:** o limite de tentativas com token inválido do `/ingest` usa o **último** valor de `X-Forwarded-For` (o que o proxy da hospedagem acrescenta). Confirmar no primeiro deploy que Railway/Fly acrescentam esse cabeçalho; sem isso o limite vale para o IP do proxy (todos juntos).
- Memória: o Chromium pede ~512 MB livres durante a geração de PDF.
- Domínio público do worker (HTTPS) → vai em `WORKER_PUBLIC_URL` do web; é o endereço que o coletor usa (`/ingest`).
- Teste de saúde: `GET /health` deve responder `{"status":"ok"}`. Nos logs deve aparecer `fila de jobs e agendador mensal LIGADOS`.

## 3. Web (Vercel)
Projeto com raiz em `apps/web`. Variáveis: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `TERMS_VERSION`, `WORKER_PUBLIC_URL`. **Não** colocar a service role no Vercel.
- Região das funções: `gru1` (São Paulo), perto do banco em `sa-east-1`.
- Domínio `app.datadops.com.br`: o Pedro aponta o DNS (CNAME para a Vercel).

## 4. Teste ponta a ponta em produção (empresa de teste)
Inclua o fluxo do corretor: (a) `/corretores` → cadastrar → `/corretor` com o link; (b) abrir o link em outra janela, fazer o diagnóstico marcando a autorização; (c) o cliente aparece no painel do corretor com nota e prontidão; (d) enviar uma evidência no cliente e ver a contagem de provas subir; (e) retirar a autorização em Empresa e conferir que o corretor perde a nota. `NEXT_PUBLIC_APP_URL` precisa ser o endereço público do portal (é ele que forma o link de indicação).
1. `/comecar` com um domínio de teste → questionário → cai no `/painel` com a animação e depois o relatório.
2. No Supabase, conferir `scan_results` (módulo `externo`) e `reports` (2 linhas).
3. `/painel/planos` → "Quero este plano" (conta permanente) → alerta aparece em `/staff`.
4. Em `/staff/org/<id>`, ativar o plano → o painel mostra lacunas, documentos, evidências e coletor.
5. Gerar token em Coletor → rodar `agent/sentinela-agent.ps1` num PC de teste → o painel passa a mostrar o diagnóstico completo, com a fonte e a divergência.
6. SOS: abrir um chamado → alerta crítico em `/staff`.
7. Logs do worker e do Vercel sem segredo, e-mail ou nome de pessoa.

## 5. Depois do deploy
- Dependabot ligado no repositório (já há `.github/dependabot.yml`).
- Rodar o checklist de `docs/SEGURANCA.md` (T22) e registrar o resultado no HISTORICO.
