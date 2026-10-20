# TAREFAS — Sentinela MVP

Regra: uma tarefa por vez, na ordem. Cada tarefa só está pronta quando cumpre **todos** os critérios de aceite, tem teste e foi registrada no HISTORICO.

Legenda: `[ ]` a fazer · `[~]` em andamento · `[x]` feito · `[!]` bloqueado (motivo ao lado)

---

## PROVA CYBER — backlog ativo (D19, spec em docs/SPEC_PROVA_CYBER.md)

Reaproveita: T01–T03 (repo, Supabase, cadastro/sessão), T04 (tela de pergunta), T05 (scan externo), T07 (pipeline PDF). Itens que mudam o banco, RLS, autenticação ou cobrança: mostrar ao Pedro e esperar o "ok".

- [ ] **P01 Modelo de dados** — migração: papéis (cliente/corretor/admin), corretor (SUSEP, Asaas), casos, perguntas (seed das 12), respostas, evidências (sha256), revisão por item, relatórios (número, validade, hash), pagamentos, assinaturas, comissões, consentimentos versionados. RLS em tudo + teste de isolamento (cliente A × B, corretor só status). Aceite: teste de RLS passa; advisors sem erro.
- [ ] **P02 Corretor** — cadastro, termo de parceria [REVISÃO JURÍDICA], link e código único, painel só com status e comissões. Aceite: corretor nunca lê respostas nem evidências.
- [ ] **P03 Cadastro do cliente** — vínculo com corretor pelo link, empresa/CNPJ/domínio/porte/faturamento/responsável, aceite versionado dos 3 itens (termos, privacidade, autorização de varredura), MFA opcional. Pendência: manter cadastro curto + completar antes do pagamento? (decidir com Pedro)
- [ ] **P04 Questionário com evidência** — 12 perguntas, Sim/Não/Parcial, upload (PNG/JPG/PDF/XLSX/CSV ≤ 10 MB, SHA-256 no servidor, bucket privado, aviso de dados pessoais), salvar e continuar, enviar para revisão. Rate limit no upload.
- [ ] **P05 Varredura externa passiva** — evoluir T05: TLS protocolo, cabeçalhos, portas/CVEs via InternetDB; só com autorização aceita; dispara no envio.
- [ ] **P06 Painel admin** — fila de casos, revisão item a item (resposta + evidência + varredura), recomendação, MFA obrigatório, audit_log.
- [ ] **P07 Relatório de Prova (PDF)** — template novo, número, validade 30 dias, SHA-256 do PDF, `/verificar/[numero]` público sem expor conteúdo.
- [ ] **P08 Cobrança e liberação** — Asaas R$ 490 + split 15%, cupom PILOTO, webhook com validação, liberação só após pagamento, URL assinada 24 h.
- [ ] **P09 E-mails transacionais** — Resend (ou similar): boas-vindas, lembretes D+2/D+5, em revisão, cobrança, relatório pronto, aviso mensal, alerta de queda, aviso ao corretor (sem detalhes).
- [ ] **P10 Assinatura e monitoramento** — Asaas recorrente R$ 290 + split, varredura mensal, reconfirmação, evidência vencida, alerta de queda, relatório mensal, suspensão após 15 dias de atraso.
- [ ] **P11 Página /sincor** — 3 passos, preço, "Sou corretor", "Sou empresa", FAQ, WhatsApp (31) 3568-1989.
- [ ] **P12 Fechamento** — retenção de 12 meses (rotina), seeds de teste, revisão de segurança (CLAUDE.md §4 item a item), checklist de deploy, README de operação (revisar um caso em 15 min).

Pendências do Pedro para este backlog: chave sandbox Asaas, chave do provedor de e-mail, textos jurídicos, logo SVG, DNS `app.datadops.com.br`, `worker/.env` (ver HISTORICO).

---

# Backlog pré-pivô (arquivado — referência)

## Semana 1 (pré-pivô) — Diagnóstico Express vendável

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

- [~] **T05 Worker + scan externo** — código e testes prontos; falta rodar o worker com SUPABASE_URL/SERVICE_ROLE_KEY e ver o scan_result gravado
  - FastAPI com loop que pega `jobs` pendentes (`for update skip locked`), máx. 3 tentativas.
  - `app/scans/external.py`: checagens X01–X06 do BASE12.json. Só consultas públicas. Timeout de 10 s por checagem.
  - Grava `scan_results` (module `externo`, summary, sha256 do JSON canônico) e `assessments.external_score`.
  - Aceite: testes com domínios reais conhecidos (ex.: um com DMARC reject e um sem DMARC); nenhuma varredura de porta.

- [x] **T06 Motor de nota**
  - `app/engine/scoring.py` e `mapping.py`: respostas + scans → `control_results` (scan manda mais; divergência marcada) → `score`.
  - Aceite: pytest cobre: tudo sim = 100; tudo não = 0; "não sei" = 0 e `sem_dado`; divergência detectada; pesos do JSON.

- [~] **T07 Relatório Express em PDF** — código e testes prontos; falta Pedro rodar o worker, aprovar o visual e ver o PDF baixar; botão "Quero contratar" pendente (precisa RPC/migração com o ok do Pedro)
  - `worker/templates/relatorio_express.html` com a identidade DataDops (CLAUDE.md §6). Playwright → PDF.
  - Salva em `reports/{org_id}/{assessment_id}/express.pdf`, grava sha256 em `reports`.
  - `/resultado`: nota, faixa, 3 maiores lacunas, botão baixar (URL assinada 5 min), botão "Quero contratar" (cria alerta para staff).
  - Aceite: PDF de 2 páginas, rodapé legal presente, abre no celular. Pedro aprova o visual.

- [ ] **T08 Deploy da semana 1**
  - Web na Vercel, worker no Railway (ou Fly.io). Variáveis de ambiente configuradas. Domínio `app.datadops.com.br` (Pedro aponta o DNS).
  - Aceite: fluxo completo em produção com uma empresa de teste; logs sem segredo exposto.

## Semana 2 — Agente e diagnóstico completo

- [ ] **T09 Tela do agente e ingestão**
  - `/agente`: gerar token (`create_agent_token`, mostrado uma vez), revogar, instruções para a TI.
  - Worker: `POST /ingest` com header `Authorization: Bearer snt_...` → valida hash, validade, revogação; limite de tamanho (256 KB) e de frequência (10/h por token); grava `scan_results`; atualiza `last_used_at`.
  - Aceite: token revogado é recusado; payload com lista de e-mails é rejeitado pelo validador.

- [ ] **T10 Agente Windows (coletor)**
  - `agent/sentinela-agent.ps1`: coleta C04, C05, C08, C09 (admin local), C10 sem nomes de usuário; hostname vira SHA-256; salva JSON completo numa pasta local escolhida pelo cliente; envia só o resumo + hash.
  - Script assinado ou com hash publicado no portal. README para a TI em linguagem simples.
  - Aceite: roda sem admin (o que não der, marca `sem_dado`); roda em Windows 10 e 11.

- [ ] **T11 Importação Maester (M365)**
  - Agente roda Maester (se a TI marcar M365) e extrai só: % usuários com MFA, admins com MFA, nº de admins globais.
  - Aceite: resumo sem nomes; mapeado para C03 e C09.

- [ ] **T12 Diagnóstico completo**
  - Ao receber dados do agente, worker cria avaliação `completo` (copia respostas da última Express), recalcula e gera PDF completo (PRODUTO.md §8).
  - `/painel` e `/controle/[id]` mostram status, fonte, data e hash curto.
  - Aceite: divergência aparece no relatório; tabela "relação com questionário da seguradora" usa só os números das perguntas.

## Semana 3 — Correção e contratação

- [ ] **T13 Checklist e fichas** — `/painel` com os 12 controles e a ficha "como corrigir" de cada um (texto do BASE12.json).
- [ ] **T14 Documentos** — gerar Política, Plano de incidente e Designação a partir de modelos em `worker/templates/docs/` (Pedro fornece os textos). Aprovação via `approve_document`.
- [ ] **T15 Upload de evidência** — bucket `evidence`, só PDF/PNG/JPG até 10 MB, sha256 calculado no servidor.
- [ ] **T16 Staff** — `/staff`, `/staff/org/[id]` com revisão (`staff_review_control`) e selo Verificado.
- [ ] **T17 Contratação** — [!] depende de preços (Pedro). Até lá: botão "Quero contratar" gera alerta. Depois: Asaas assinatura.

## Semana 4 — Permanência

- [ ] **T18 Execução mensal** — tarefa agendada do Windows criada pelo agente; worker gera avaliação `mensal`.
- [ ] **T19 Comparação e alertas** — `diff.py` compara com o mês anterior; piora cria `alerts` + e-mail (Resend ou SMTP).
- [ ] **T20 Relatório mensal** — PDF de 1 página.
- [ ] **T21 SOS** — `/sos` cria `incidents` + e-mail para a equipe + mostra plano de incidente aprovado.
- [ ] **T22 Revisão de segurança final** — checklist do CLAUDE.md §4 item a item, advisors, teste de RLS, revisão de dependências. Registrar resultado no HISTORICO.

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
