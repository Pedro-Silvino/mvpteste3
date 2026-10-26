# TAREFAS — Sentinela MVP

Regra: uma tarefa por vez, na ordem. Cada tarefa só está pronta quando cumpre **todos** os critérios de aceite, tem teste e foi registrada no HISTORICO.

Legenda: `[ ]` a fazer · `[~]` em andamento · `[x]` feito · `[!]` bloqueado (motivo ao lado)

---

## Semana 1 — Diagnóstico Express vendável

- [x] **T01 Repositório e ferramentas**
  - Git, `.gitignore`, pnpm workspace, `apps/web` (Next.js 15 + TS + Tailwind), `worker/` (uv + FastAPI), Supabase CLI.
  - Aceite: `pnpm dev` abre a página inicial; `uv run pytest` passa com 1 teste vazio; Dependabot configurado.

- [x] **T02 Supabase**
  - Criar projeto `sentinela-mvp` (sa-east-1). Linkar CLI. Mostrar a migração inicial ao Pedro, aplicar após o "ok".
  - Rodar advisors de segurança e corrigir o que aparecer.
  - Pedro vira staff → movido para a T03 (depende do primeiro login).
  - Aceite: 17 tabelas com RLS ligado; advisors sem erro crítico; `supabase/tests/01_rls_test.sql` passa num Postgres local (instruções no arquivo).

- [~] **T03 Login e cadastro da empresa** — (D18: /comecar agora pede só domínio + termos) código e testes prontos (fluxo D16: diagnóstico anônimo → `/conta` com e-mail e senha); falta teste ponta a ponta (Pedro: ajustes no painel do Supabase, ver HISTORICO)
  - ~~`/entrar` com código OTP~~ → D16: `/entrar` com e-mail + senha; `/conta` salva o diagnóstico; `/esqueci-senha`.
  - `/comecar`: formulário (nome, CNPJ, domínio, setor, faixa de funcionários) + checkbox de termos + captura de `?p=CODIGO` (cookie de 30 dias). Chama `create_organization`.
  - Validação com Zod. Máscara de CNPJ.
  - Depois do primeiro login do Pedro: `update profiles set is_staff = true where id = '<id do Pedro>';` (SQL aprovado pelo Pedro).
  - Aceite: empresa criada, parceiro gravado, 3 aceites gravados, job `scan_externo` criado. Usuário B não vê a empresa de A.

- [~] **T04 Questionário Base 12** — código e testes prontos; falta Pedro testar no celular (375 px) e ponta a ponta
  - `/diagnostico`: 4 perguntas de cadastro extra + 12 perguntas, uma por tela, barra de progresso, botão "Não sei", pode voltar.
  - Perguntas vêm de `docs/BASE12.json` (copiar para `apps/web/lib/base12.json` via script, fonte única continua em `docs/`).
  - Ao fim chama `submit_assessment`.
  - Aceite: funciona no celular (375 px); respostas salvas a cada tela (sair e voltar não perde).

- [x] **T05 Worker + scan externo** — verificado no banco real em 2026-10-21 (scan_results gravado, external_score = 58)
  - FastAPI com loop que pega `jobs` pendentes (`for update skip locked`), máx. 3 tentativas.
  - `app/scans/external.py`: checagens X01–X06 do BASE12.json. Só consultas públicas. Timeout de 10 s por checagem.
  - Grava `scan_results` (module `externo`, summary, sha256 do JSON canônico) e `assessments.external_score`.
  - Aceite: testes com domínios reais conhecidos (ex.: um com DMARC reject e um sem DMARC); nenhuma varredura de porta.

- [x] **T06 Motor de nota**
  - `app/engine/scoring.py` e `mapping.py`: respostas + scans → `control_results` (scan manda mais; divergência marcada) → `score`.
  - Aceite: pytest cobre: tudo sim = 100; tudo não = 0; "não sei" = 0 e `sem_dado`; divergência detectada; pesos do JSON.

- [~] **T07 Relatório Express em PDF** — D20: PDF grátis (1 página, sem lacunas) e PDF completo (3 páginas, lacunas + como resolver); painel `/painel` com planos. Falta: Pedro aprovar a migração `20261021120000_request_plan.sql` e ver o fluxo no navegador.
  - `worker/templates/relatorio_express.html` com a identidade DataDops (CLAUDE.md §6). Playwright → PDF.
  - Salva em `reports/{org_id}/{assessment_id}/express.pdf`, grava sha256 em `reports`.
  - `/resultado`: nota, faixa, 3 maiores lacunas, botão baixar (URL assinada 5 min), botão "Quero contratar" (cria alerta para staff).
  - Aceite: PDF de 2 páginas, rodapé legal presente, abre no celular. Pedro aprova o visual.

- [~] **T08 Deploy da semana 1** — artefatos prontos (`worker/Dockerfile`, cabeçalhos de segurança, `docs/DEPLOY.md`); nada foi publicado e a imagem do worker não foi testada (sem Docker na máquina). Falta: Pedro pedir o deploy e apontar o DNS.
  - Web na Vercel, worker no Railway (ou Fly.io). Variáveis de ambiente configuradas. Domínio `app.datadops.com.br` (Pedro aponta o DNS).
  - Aceite: fluxo completo em produção com uma empresa de teste; logs sem segredo exposto.

## Semana 2 — Agente e diagnóstico completo

- [~] **T09 Tela do agente e ingestão** — código e testes prontos (`/painel/agente`, `POST /ingest` com validação rígida, limite de 10/h, token revogado recusado). Falta testar com o banco real depois da migração.
  - `/agente`: gerar token (`create_agent_token`, mostrado uma vez), revogar, instruções para a TI.
  - Worker: `POST /ingest` com header `Authorization: Bearer snt_...` → valida hash, validade, revogação; limite de tamanho (256 KB) e de frequência (10/h por token); grava `scan_results`; atualiza `last_used_at`.
  - Aceite: token revogado é recusado; payload com lista de e-mails é rejeitado pelo validador.

- [~] **T10 Agente Windows (coletor)** — `agent/sentinela-agent.ps1` roda sem admin e o `-DryRun` foi executado na máquina do Pedro; contrato com o worker coberto por teste; hash publicado no painel. Falta: envio real com um token e teste em Windows 10 (só rodou no 11).
  - `agent/sentinela-agent.ps1`: coleta C04, C05, C08, C09 (admin local), C10 sem nomes de usuário; hostname vira SHA-256; salva JSON completo numa pasta local escolhida pelo cliente; envia só o resumo + hash.
  - Script assinado ou com hash publicado no portal. README para a TI em linguagem simples.
  - Aceite: roda sem admin (o que não der, marca `sem_dado`); roda em Windows 10 e 11.

- [~] **T11 Importação Maester (M365)** — o worker já aceita e mapeia o resumo do M365 (C03 e C09, sem nomes). A coleta com o Maester ainda não está no coletor: a TI roda o Maester e fala com a equipe.
  - Agente roda Maester (se a TI marcar M365) e extrai só: % usuários com MFA, admins com MFA, nº de admins globais.
  - Aceite: resumo sem nomes; mapeado para C03 e C09.

- [~] **T12 Diagnóstico completo** — o worker junta respostas + coletor (scan manda mais, divergência marcada), gera o PDF completo e o painel mostra fonte e divergência. Falta teste com dados reais e a tabela "relação com o questionário da seguradora" (BASE12 tem os números, ainda não entrou no PDF).
  - Ao receber dados do agente, worker cria avaliação `completo` (copia respostas da última Express), recalcula e gera PDF completo (PRODUTO.md §8).
  - `/painel` e `/controle/[id]` mostram status, fonte, data e hash curto.
  - Aceite: divergência aparece no relatório; tabela "relação com questionário da seguradora" usa só os números das perguntas.

## Semana 3 — Correção e contratação

- [~] **T13 Checklist e fichas** — `/painel/riscos` lista as lacunas com a ficha "como resolver" (planos pagos). Falta a visão com os 12 controles juntos e a página `/controle/[id]`.
- [~] **T14 Documentos** — worker gera Política, Plano de incidente e Designação (modelos-base marcados [REVISÃO JURÍDICA]); painel pede, baixa e aprova. Falta: migração aplicada e os textos finais do Pedro/advogado.
- [~] **T15 Upload de evidência** — `/painel/evidencias`: envio direto ao bucket; o **worker** confere tipo real, tamanho e calcula o SHA-256 (D27), mostra "em verificação"/"recusado". Só plano pago (barrado no banco). Falta: migração aplicada e rotina para apagar arquivos órfãos.
- [~] **T16 Staff** — `/staff` (alertas, empresas) e `/staff/org/[id]` (ativar plano, revisar controle, resolver alerta). Falta: o selo "Verificado" (hoje a revisão só muda o status do controle) e migração aplicada.
- [!] **T17 Contratação** — depende de preços (Pedro). Até lá: "Quero este plano" gera pedido para a equipe, que ativa o plano em `/staff`. Depois: Asaas.

## Semana 4 — Permanência

- [~] **T18 Execução mensal** — agendador no worker cria a verificação mensal (30 dias) para planos pagos. A tarefa agendada do Windows no coletor ainda não existe.
- [~] **T19 Comparação e alertas** — `diff.py` compara com o mês anterior (só piora comprovada), cria alertas e e-mail via Resend (desligado sem chave). Falta teste com o banco real.
- [~] **T20 Relatório mensal** — PDF de 1 página pronto e testado; aparece no histórico de relatórios do painel.
- [~] **T21 SOS** — `/painel/sos` abre incidente (até 3/h), gera alerta crítico, manda e-mail para `STAFF_ALERT_EMAIL` (D29) e mostra os primeiros passos e o plano de incidente aprovado. Falta: migração aplicada e chave do Resend.
- [~] **T22 Revisão de segurança final** — rodada 1 em `docs/SEGURANCA.md`; rodada 2 (auditoria completa, 37 achados, 29 corrigidos) em `docs/audit/`. Falta repetir depois do deploy (advisors, ambiente real).

---

## Pendências do Pedro (não bloqueiam a semana 1)
- [ ] Textos finais: termos de uso, aviso de privacidade, rodapé legal (advogado).
- [ ] Modelos de documentos (Política, Plano de incidente, Designação).
- [ ] Preços dos planos.
- [ ] Logo em SVG.
- [ ] DNS de `app.datadops.com.br`.

---

## Dívidas (recomendações médias/baixas do auditor-seguranca)
> Preenchido pela skill `/proxima-issue` quando o auditor aprova uma tarefa mas aponta melhorias não bloqueantes.
- 
