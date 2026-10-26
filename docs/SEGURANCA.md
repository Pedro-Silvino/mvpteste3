# SEGURANÇA — revisão do CLAUDE.md §4 (T22, rodada de 2026-10-22)

Revisão feita sobre o código e os testes locais. **Não substitui** a rodada final depois do deploy (advisors do Supabase nas migrações novas, teste no ambiente real). Legenda: ✅ atende e há teste/evidência · 🟡 atende em parte · ❌ pendente.

## Checklist item a item

| # | Regra | Situação | Evidência / o que falta |
|---|---|---|---|
| 1 | RLS em toda tabela | ✅ local · 🟡 remoto | 18 tabelas com RLS (a nova é `evidence`). `supabase/tests/01_rls_test.sql` (T1–T16) e `02_features_test.sql` (T17–T66, 50 verificações) passam no Postgres local: B não vê dados de A, anônimo bloqueado, cliente não muda plano/CNPJ/nota. **Falta:** aplicar as 2 migrações no `sentinela-mvp` e rodar `get_advisors`. |
| 2 | Service role só no servidor | ✅ | Só o worker usa (`worker/app/db.py`). O web não usa: tudo vai pela sessão do usuário + RLS. Nenhuma variável `NEXT_PUBLIC_` com chave secreta. |
| 3 | Nunca guardar senha/credencial de cliente | ✅ | O coletor não lê nem envia credenciais (`agent/README.md`); o validador do worker recusa campo desconhecido (`test_ingest.py`). |
| 4 | Minimizar dados pessoais | ✅ | Só contagens e booleanos. Nome do computador vira SHA-256 no próprio PC; lista de e-mails/usuários é rejeitada (422, sem eco do valor). **Atenção:** prints enviados como evidência podem conter dados pessoais: o aviso está na tela de envio; revisar o texto com o advogado. |
| 5 | SHA-256 de evidência, relatório e scan | ✅ local · 🟡 remoto | `evidence.sha256` calculado **pelo worker** a partir dos bytes do bucket; o cliente não tem INSERT em `evidence` (T48 do teste de banco; D27). `reports.sha256`, `documents.sha256`, `scan_results.sha256` gravados pelo worker. **Falta:** aplicar a migração `features` no remoto. |
| 6 | Token do agente: uma vez, só hash, validade, revogação | ✅ | `create_agent_token` devolve o texto uma vez e guarda o hash; 400 dias de validade; `revoke_agent_token`; `/ingest` recusa revogado/expirado/desconhecido (`test_ingest.py`). O hash nunca é legível pelo cliente (T7 do teste de RLS). |
| 7 | Segredos só em variável de ambiente | ✅ | `.gitignore` cobre `.env*`; `.env.example` atualizado; nenhum segredo no código. |
| 8 | Ação sensível grava `audit_log` | ✅ | Todas as RPCs gravam: criar empresa, pedir plano, ativar plano, revisar controle, resolver alerta, abrir SOS, pedir/aprovar documento, token do agente, dados da empresa. |
| 9 | Validação de entrada (Zod / Pydantic), sem SQL concatenado | ✅ | Zod em toda server action; Pydantic estrito no `/ingest`; SQL só por RPC parametrizada ou PostgREST. |
| 10 | Scan externo só com consulta pública; porta só com autorização | ✅ | `external.py`: DNS, TLS e cabeçalhos da página inicial; recusa IP não público; cada redirecionamento só para http/https, porta padrão e IP público (auditoria S01, `test_external.py`). Resta o risco de DNS rebinding (ver `docs/audit/03-relatorio-final.md` §5). |
| 11 | Dependências com versão fixa; Dependabot | 🟡 | Dependabot configurado; `pnpm-lock.yaml` e `uv.lock` travam as versões. Alguns `package.json` ainda usam `^` (Tailwind, tipos). Fixar antes da T08. |
| 12 | Buckets privados, URL assinada curta | ✅ | `reports`, `documents`, `evidence` privados; downloads por URL assinada de 5 min. |
| 13 | Sem dado real de cliente em teste/log | ✅ | Fixtures fictícias (hash de máquina trocado por valor fictício em `test_agent_contract.py`). Logs registram só códigos de erro. |
| 14 | Não enfraquecer teste/lint/RLS | ✅ | Nenhum teste desligado; um teste que falhou (`T53`) foi corrigido porque a expectativa estava errada, não o banco. |
| 15 | Sem `push --force`/`reset --hard`; deploy só a pedido | ✅ | Bloqueados em `.claude/settings.json`. Nada foi feito push ou deploy. |
| 16 | Rate limit em rota pública | 🟡 | `/ingest`: 10/h por token, 20 tentativas com token inválido por endereço em 10 min e corpo limitado a 256 KB antes de ler. SOS: 3/h por empresa. Login: limite nativo do Supabase. Cadastro anônimo: limite do Supabase (30/h por IP) + 3 empresas por conta. Sem captcha ainda (D17). |
| 17 | Erro genérico para o cliente; detalhe só no log | ✅ | Server actions devolvem mensagem genérica; `/ingest` devolve `invalid_payload`; stack e mensagem do Postgres só em `console.error`/log. |

## Novos pontos desta rodada

> Rodada 2 (auditoria de 2026-10-21 a 26): achados, correções e pendências em `docs/audit/02-achados.md` e `docs/audit/03-relatorio-final.md`.

| Ponto | Situação | Detalhe |
|---|---|---|
| Área `/staff` | ✅ | Responde 404 para quem não é staff (`requireStaff`); o banco repete a regra (`is_staff()` nas RPCs e no RLS). |
| Plano pago só vale na interface? | 🟡 | **Evidência e pedido de documento são barrados no banco** (políticas `ev_insert`, `storage_evidence_insert` e `request_document` exigem plano pago; T30–T32 e T47–T60). **Lacunas e o PDF completo são só barreira de produto:** um membro técnico poderia pedir direto ao Storage a URL do PDF completo (a leitura é por pasta da empresa). Endurecer na cobrança (T17). |
| Upload direto ao Storage | ✅ | O arquivo vai do navegador ao bucket; o worker confere tipo real, tamanho e hash antes de registrar e **apaga o arquivo inválido**. Arquivo enviado sem pedir registro ainda pode ficar órfão (rotina de limpeza pendente). |
| Cabeçalhos HTTP | 🟡 | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP, HSTS (produção) e CSP parcial (`frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`), com teste em `lib/security-headers.test.ts`. **Falta:** `script-src` com nonce. |
| Retenção de dados | ❌ | Sem rotina para apagar evidências e dados após o fim do contrato. Definir prazo com o advogado. |
| Sessões anônimas abandonadas (D17) | ❌ | Rotina de limpeza ainda não existe. |
| Confirmação de e-mail desligada (D16/D17) | 🟡 | Qualquer pessoa pode cadastrar e-mail alheio. O e-mail de alerta só vai ao dono com conta permanente; avaliar ligar a confirmação antes do público aberto. |
| Worker em instância única | 🟡 | Limite do coletor e agendador mensal em memória. |
| Documentos | 🟡 | Modelos-base marcados `[REVISÃO JURÍDICA]`; o conteúdo precisa de revisão do advogado antes de ser oferecido como definitivo. |

## Como repetir a verificação
- Banco: `bash supabase/tests/run_local.sh` (precisa do PostgreSQL 17 local; sem Docker).
- Web: `pnpm test && pnpm lint && pnpm typecheck` em `apps/web`.
- Worker: `uv run pytest` em `worker/`.
- Depois do deploy: `get_advisors` (segurança e desempenho) e o roteiro de `docs/DEPLOY.md` §4.
