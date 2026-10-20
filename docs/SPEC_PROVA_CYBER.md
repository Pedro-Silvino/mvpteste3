# SPEC — Prova Cyber (DataDops) · lançamento Sincor-MG

Substitui o foco "Diagnóstico Express + nota" (ver D19 em DECISOES.md). O que já existe e continua valendo: Supabase, RLS, auditoria, parceiros por código, scan externo público, PDF por HTML → Playwright, worker Python.

## 1. Produto em uma frase
A PME responde o questionário de risco do seguro cyber **com prova** de cada controle e recebe um **Relatório de Prova** datado, revisado por humano. Depois, monitoramento mensal mantém a declaração verdadeira.

## 2. Atores
| Ator | Faz | Vê |
|---|---|---|
| Corretor (Sincor-MG) | cadastra, divulga link/código, acompanha | só **status** dos indicados e comissões. Nunca respostas/evidências (salvo autorização explícita do cliente) |
| Cliente (PME) | cadastra, aceita 3 termos, responde, envia evidência, paga, baixa relatório | só o que é seu |
| Revisor/Admin DataDops | revisa item a item, gera relatório | tudo; MFA obrigatório; tudo em `audit_log` |

## 3. Fluxo
1. Corretor se cadastra (aceita termo de parceria) → link + código.
2. Cliente chega pelo link (vínculo gravado) ou direto → cadastro → aceita termos, privacidade e **autorização de varredura externa** (com versão e data).
3. Questionário de 12 itens: Sim/Não/Parcial + evidência (PNG, JPG, PDF, XLSX, CSV ≤ 10 MB; SHA-256 + data; storage privado; aviso de não enviar dado pessoal). Salva e continua depois.
4. Envio → caso vai para revisão **e** dispara varredura externa passiva (SPF, DMARC, DKIM, TLS validade/protocolo, cabeçalhos HTTP, portas/CVEs por fonte passiva pública).
5. Revisor marca cada item: ✅ Provado · ⚠️ Declarado sem prova suficiente · ❌ Lacuna + recomendação curta → **Gerar relatório**.
6. Cobrança Asaas R$ 490 (Pix/cartão/boleto), split 15% ao corretor; cupom **PILOTO** zera. Relatório só libera com pagamento confirmado (webhook validado).
7. Entrega por e-mail (URL assinada 24 h) e no painel. Oferta da assinatura R$ 290/mês (12 meses, split 15%).
8. Mensal (assinantes): nova varredura + pedido de reconfirmação + evidências vencidas (ex.: teste de backup > 90 dias); alerta se item cair de ✅; relatório mensal novo (número e hash novos); inadimplência > 15 dias suspende.

## 4. Relatório de Prova (PDF)
Capa (empresa, CNPJ, data, nº, validade 30 dias) · resumo (X provados, Y sem prova, Z lacunas) · tabela por pergunta (status, arquivo + SHA-256 + data, recomendação) · varredura externa · plano de correção priorizado · hash SHA-256 do PDF no banco · página pública `/verificar/[numero]` (confirma autenticidade sem expor conteúdo).
Rodapé fixo: *"Este relatório registra evidências de controles na data indicada. Não garante aceitação do seguro nem pagamento de indenização. Serviço prestado como obrigação de meio."*

## 5. Segurança (inegociável, soma-se ao CLAUDE.md §4)
RLS em tudo · storage privado + URL assinada curta · só evidência de controle, nunca dado de terceiros · retenção: evidências apagadas 12 meses após fim do contrato, hash e registro do relatório ficam · `audit_log` para revisão, geração, download, mudança de status · webhook Asaas com validação · rate limit em login e upload · varredura só em domínio autorizado e **passiva**.

## 6. Fora do escopo
Agente na rede · M365/Google · gestão de ativos · CVE interno · várias seguradoras · app mobile · IA gerando recomendação sem revisão humana.

## 7. Pronto quando (ponta a ponta)
1 corretor recebe link · 2 cliente entra, aceita, preenche, envia · 3 varredura grava resultado · 4 admin revisa e gera PDF com hash · 5 cobrança com split em sandbox + cupom PILOTO · 6 relatório só após pagamento · 7 `/verificar` confirma hash · 8 assinatura mensal, varredura do mês seguinte e alerta de queda (simulados) · 9 corretor vê só status e comissão · 10 testes de RLS provam isolamento entre clientes.
