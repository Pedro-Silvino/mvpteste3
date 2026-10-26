# PRODUTO — Sentinela MVP

## 1. Em uma frase
A empresa responde 12 perguntas simples, a máquina confere o que dá para conferir sozinha, e a empresa recebe uma nota, um plano de correção e, todo mês, um relatório provando que continua em dia.

## 2. Planos (o que o sistema precisa suportar)

| Plano | Para quem | O que libera no sistema |
|---|---|---|
| **Diagnóstico Express** (grátis) | Qualquer lead | Cadastro, scan externo, questionário Base 12, PDF Express |
| **Essencial** (mensal) | Até ~50 funcionários | Tudo do Express + agente + checklist + documentos + relatório mensal + alertas |
| **Dossiê Prova** (projeto 30 dias) | Quem precisa provar a alguém | Tudo do Essencial + revisão da equipe (selo Verificado) + Dossiê |
| **DataDops 360** (mensal) | Média empresa | Tudo + revisão mensal pela equipe |

Preços: **não definidos**. Campo `plan` na organização; nada de valor na tela.

## 3. Fluxo (10 etapas)

| # | Etapa | Cliente faz | Sistema faz | Semana |
|---|---|---|---|---|
| 1 | Entrada | Abre o link (site, corretor ou parceiro: `?p=CODIGO`). Informa empresa, CNPJ, domínio, setor, nº de funcionários e aceita termos (sem login: o sistema abre uma sessão anônima). Cria e-mail e senha só no fim, para salvar o resultado | Cria organização, grava parceiro de origem, grava aceite em `authorizations` | 1 |
| 2 | Scan externo | Espera ~30 s | Worker checa: MX, SPF, DMARC, DKIM (seletores comuns), certificado TLS (validade, emissor), HTTPS obrigatório, cabeçalhos de segurança. Mostra "nota externa" | 1 |
| 3 | Questionário | Responde 12 perguntas (sempre existe "Não sei") | Calcula nota 0–100, mostra 3 maiores lacunas, gera **PDF Express** e envia por e-mail | 1 |
| 4 | Contratação | Pequena: assina Essencial. Média: pede proposta (resposta em 1 dia útil) | Fase 1: botão "Quero contratar" → alerta para a equipe. Fase 3: checkout Asaas + contrato | 1 / 3 |
| 5 | Conexão | TI (ou MSP) baixa o agente e roda uma vez | Portal gera token do agente. Agente roda Maester (se M365) + coletor Windows, salva evidência completa na pasta do cliente e envia **só resumo + SHA-256** | 2 |
| 6 | Diagnóstico completo | Recebe relatório | Orquestrador converte resultados em status por controle (scan tem prioridade sobre resposta), recalcula nota, gera PDF completo | 2 |
| 7 | Correção | TI segue fichas. Dono aprova documentos | Checklist por controle com ficha "como corrigir". Ao rodar o agente de novo, status atualiza sozinho. Documentos gerados a partir de modelos | 3 |
| 8 | Dossiê | Recebe Dossiê | Gera Dossiê com selo Autoavaliado ou Verificado (staff marca revisão) | 3 |
| 9 | Mensal | Lê relatório de 1 página | Agente agendado (tarefa do Windows) envia todo mês. Worker compara com o mês anterior; se piorou, cria alerta (e-mail; WhatsApp depois) | 4 |
| 10 | Incidente | Aperta "SOS" | Cria chamado, avisa a equipe, mostra o plano de incidente do cliente | 4 |

## 4. Regra de ouro das respostas

- **Scan manda mais que resposta.** Se o scan viu, vale o scan. Se o scan não viu, vale a resposta.
- "Não sei" = `sem_dado`. Conta como 0 na nota e vira tarefa: "verificar com a TI / rodar o agente".
- Divergência (cliente disse "sim", scan viu "não") → status do scan + aviso no relatório: "resposta diferente do verificado".

## 5. Telas

**Cliente**
1. `/comecar` — dados da empresa + aceite (porta de entrada, sem login).
2. `/conta` — salvar o diagnóstico: e-mail + senha (converte a sessão anônima). `/entrar` — login de volta; `/esqueci-senha`.
3. `/diagnostico` — scan externo (barra de progresso) → 12 perguntas, uma por tela, com barra de progresso e botão "Não sei".
4. `/resultado` — nota, 3 lacunas, botão baixar PDF, botão "Quero contratar".
5. `/painel` — nota atual, evolução mês a mês, checklist dos 12 controles, alertas.
6. `/controle/[id]` — status, evidência (data + hash), ficha "como corrigir".
7. `/agente` — gerar token, baixar agente, instruções para a TI.
8. `/documentos` — documentos gerados, aprovar.
9. `/relatorios` — lista de PDFs.
10. `/sos` — botão de incidente.

**Staff (DataDops)**
1. `/staff` — lista de organizações, nota, plano, último envio do agente, alertas abertos.
2. `/staff/org/[id]` — ver tudo, marcar controle como "revisado" (selo Verificado), anotar.
3. `/staff/leads` — Express concluídos com botão "contatar".

## 6. Experiência de cada pessoa

- **Dono:** 15 min no início. Depois, lê 1 relatório por mês.
- **TI / MSP:** 1–2 h para rodar o agente. Depois, segue fichas.
- **Corretor:** cadastra a corretora, manda o link com código e acompanha, em `/corretor`, cada cliente indicado: etapa, nota, prontidão para o questionário de seguro e provas. Só vê o resultado de quem autorizou (D31).
- **Pedro:** só revisa quando o plano é Dossiê ou 360.

## 7. O que o sistema guarda / não guarda

| Guarda | Não guarda |
|---|---|
| Cadastro da empresa, aceites com data e IP | Senhas, tokens ou chaves do cliente |
| Respostas do questionário | Lista de usuários, e-mails ou nomes de funcionários |
| Resumo do scan (contagens e booleanos) + SHA-256 | Arquivo completo de evidência (fica na pasta do cliente) |
| Status por controle e histórico mensal | Conteúdo de e-mails ou arquivos do cliente |
| PDFs gerados + SHA-256 | |
| Log de auditoria | |

## 8. Relatório PDF (conteúdo)

**Express (2 páginas):** capa com nota e data · nota externa · 3 maiores lacunas com "por que importa" em 1 linha · próximos passos · rodapé legal.

**Completo:** capa · resumo para a diretoria (5 tópicos) · nota por área · tabela dos 12 controles (status, fonte, data, hash curto) · divergências · plano priorizado (30/60/90 dias) · relação com o questionário da seguradora (nº das perguntas) · rodapé legal.

**Mensal (1 página):** nota do mês vs. anterior · o que melhorou · o que piorou · pendências.

## 9. Fora do MVP (não construir agora)
Google Workspace/ScubaGoggles (só entra se um cliente pagante usar Google) · WhatsApp · Asaas split · nuvem/Terraform · app mobile · IA gerando texto · multi-idioma · white-label.
