# 03 — Relatório final da auditoria (2026-10-21 a 2026-10-26)

Branch `audit/melhorias-2026-10-21` (12 commits sobre `master` 77926b0). **Nada foi enviado (push), mergeado, publicado nem aplicado no Supabase remoto.**

## 1. Resumo executivo
- **O funil principal deixou de ter armadilhas.** O botão da home levava ao login; um scan que falhava travava o questionário e mostrava "Algo deu errado"; um domínio aceito no cadastro podia ser recusado pelo scan. Os três foram corrigidos e cobertos por testes. Um diagnóstico com erro agora tem o botão **"Tentar de novo"**.
- **Fechamos 3 brechas de segurança relevantes no worker:**
  - **Redirecionamento (SSRF):** o site analisado podia mandar o worker para a rede interna ou para os metadados da nuvem.
  - **Envio gigante:** sem token, um único envio podia esgotar a memória.
  - **Tokens falsos:** era possível consultar o banco sem limite.
- **Dependências sem vulnerabilidade conhecida em produção** (eram 8, 4 altas).
- **O SHA-256 da evidência passa a ser sempre do servidor.** O worker lê o arquivo, confere o tipo real e calcula o hash; o cliente não grava mais a linha. Isso sustenta o que vendemos: "evidência registrada".
- **SOS:** a equipe recebe e-mail (`STAFF_ALERT_EMAIL`) e há limite de 3 chamados por hora por empresa.
- **Acessibilidade e marca:**
  - Botões e links passaram no contraste WCAG AA (de 3,6:1 para 5,7:1) com um tom mais escuro do mesmo teal.
  - O foco de teclado ficou visível.
  - Botões e campos têm uma classe única cada.
- **Os textos pararam de prometer o que o sistema não faz:** "equipe avisada", "contato pelo e-mail" para quem não tem e-mail, "plano do que corrigir" no grátis.

## 2. Placar
| Eixo | Encontrados | Corrigidos ✅ | Recomendação | Parada |
|---|---|---|---|---|
| Segurança | 13 | 8 | 3 (S06, S07, S10) | 2 (S14, S15) |
| Produto | 10 | 9 | 1 (P09) | 0 |
| UX/Acessibilidade | 7 | 7 | 0 | 0 |
| UI | 3 | 3 | 0 | 0 |
| Código/Performance | 4 | 2 | 1 (C01) | 1 (C03) |
| **Total** | **37** | **29** | **5** | **3** |

Por severidade:
- **Crítica:** 1, corrigida.
- **Alta:** 7, sendo 6 corrigidas e 1 Parada (S15, termos vazios).
- **Média:** 17, sendo 12 corrigidas e 5 recomendações.
- **Baixa:** 12, sendo 10 corrigidas e 2 Paradas.

S05 e S12 estão corrigidos no código e na migração **local**; aplicar no remoto depende do seu "ok" (item 6).

## 3. Validação (antes → depois)
| Comando | Antes (linha de base) | Depois |
|---|---|---|
| `pnpm install --frozen-lockfile` (limpo) | — | ✅ |
| `pnpm test` (web) | 63/63 | **67/67** (14 arquivos) |
| `pnpm lint` / `pnpm typecheck` | ✅ / ✅ | ✅ / ✅ |
| `pnpm build` | ✅ 28 rotas, 102 kB compartilhado | ✅ 29 rotas (+`robots.txt`), 102 kB, middleware 94,7 kB |
| `uv run pytest` (worker) | 111/111 | **134/134** |
| `bash supabase/tests/run_local.sh` (RLS + funcionalidades, Postgres 17 local) | 50/50 | **66/66** |
| `pnpm audit --prod` | 8 (4 altas, 4 moderadas) | **0** |
| `pnpm audit` (com dev) | — | 1 alta só em dev (`braces` via `eslint-config-next`; sem versão corrigida) |
| `pip-audit` | não rodou (sem acesso ao pypi.org) | não rodou (mesmo motivo) |
| Contraste AA (verificador próprio, telas públicas a 1280 px) | 9 falhas (home 1, comecar 3, entrar 4, esqueci 1) | **0** |
| Foco visível em 4 Tabs | 2/4, 3/4, 2/4, 1/4 | 3/4, 4/4, 4/4, 3/4 |
| Scroll horizontal (360/768/1280) | nenhum | nenhum |

**O ataque foi testado, não só o caso feliz:**
- **SSRF:** testes com redirecionamento para `127.0.0.1`, `169.254.169.254`, `[::1]`, outra porta, `ftp://` e `file://`, mais teste real (`127.0.0.1:8000` e `169.254.169.254` → bloqueados; `google.com` segue funcionando).
- **`/ingest`:** envio com `Content-Length` de 50 MB, corpo em stream acima de 256 KB e 25 tokens falsos seguidos (o banco para de ser consultado depois de 20).
- **Evidência:** inserção direta é negada pelo banco (T48), mesmo no plano pago; executável com nome `.png` é recusado e apagado do bucket.
- **E-mail:** HTML injetado pelo domínio sai escapado.

**Não verificado:**
- Telas logadas no navegador: exigiriam criar usuário no Supabase remoto.
- Imagem Docker: não há Docker na máquina.
- Lighthouse/axe: sem acesso para instalar. Usei um verificador de contraste, rótulos e foco feito com Playwright; o resultado está em `screenshots/*-a11y.json`.

Capturas antes e depois (home, comecar, entrar, esqueci-senha em 360, 768 e 1280 px) estão em `docs/audit/screenshots/`.

## 4. Commits
| Commit | O quê |
|---|---|
| f518121 | docs(audit): contexto, linha de base e achados |
| 7631b59 | fix(worker): scan externo que desiste não marca mais o diagnóstico como erro (P01) |
| c654aa8 | fix(security): scan não segue redirecionamento para rede interna/outra porta/protocolo (S01) |
| 8931794 | fix(security): /ingest recusa corpo grande e limita tokens inválidos por endereço (S02, S03) |
| 784a32e | fix(deps): next 15.5.28, postcss/sharp/source-map-js corrigidos, dev deps fixadas (S04, C02) |
| 99b949f | fix(web): domínio do cadastro com a mesma regra do worker (P02) |
| c17130f | fix(ui): tokens, contraste AA, foco visível, botões/campos únicos, home (A01–A03, A07, U01–U03, P03, P04) |
| c04df9b | fix(web): textos honestos, confirmações, CSP parcial, robots, questionário (P05–P08, P10, A04–A06, S08, C04) |
| a9ed7b1 | fix(security): e-mail mensal com escape (S09) |
| eb536a4 | docs(audit): proposta SQL e capturas antes |
| 443b188 | feat: evidência só pelo worker, reprocessar diagnóstico, SOS com limite e e-mail (S05, S12, P05, P07) |
| (este) | docs: relatório final, histórico, decisões, segurança |

## 5. Recomendações não aplicadas (por prioridade)
| # | Item | Esforço | Por que não agora |
|---|---|---|---|
| 1 | **S06** PDF completo acessível pelo Storage no plano grátis: separar bucket/pasta e política por plano | M | Já registrado na D20; muda a política de Storage (vai junto com a cobrança, T17) |
| 2 | **S10** token do coletor no histórico do PowerShell: ler de variável de ambiente ou `Read-Host -AsSecureString` | M | Muda o script e o hash publicado; testar em Windows 10 e 11 |
| 3 | **S07** `request_ip()` confia no 1º `X-Forwarded-For` enviado por quem chama: assinar o IP no servidor | M | Migração e desenho de confiança entre Vercel e Supabase |
| 4 | **CSP com nonce** para `script-src` (hoje só `frame-ancestors`, `base-uri`, `form-action`, `object-src`) | M | Exige mudar o middleware e testar todas as telas |
| 5 | **P09** revisão da equipe recalcular nota e PDF (selo "Verificado" de verdade) | M | Regra de negócio (T16) |
| 6 | **C01** `getPainel` com ~10 consultas por página | M | Não é gargalo no volume do MVP |
| 7 | DNS rebinding no scan (a checagem de IP e a conexão resolvem o nome duas vezes) | M | Fixar o IP na conexão exige transporte próprio do httpx |
| 8 | Limpeza periódica de sessões anônimas e de arquivos de evidência órfãos | P | Apagar dados exige rotina aprovada (D17) |

## 6. Itens de PARADA (decisão sua)
**P1. Aplicar as migrações no Supabase `sentinela-mvp`** (`20261021120000_request_plan.sql` e `20261022000000_features.sql`, esta agora com S05/S12 e reprocessamento)
- **Risco:** baixo. Só cria funções, tabela `evidence` e políticas; não apaga nem altera dados existentes. Testadas no Postgres 17 local (66/66).
- **Passo a passo:**
  1. Ler o SQL dos dois arquivos.
  2. Dar o "ok".
  3. `supabase db push`, no projeto linkado `gcysfzzpiwospnmwkcar`.
  4. Rodar `get_advisors` (segurança).
  5. `supabase gen types typescript --linked > apps/web/lib/database.types.ts`.
  6. Seguir `docs/DEPLOY.md` §4.

**P2. Termos de uso e aviso de privacidade (S15)**
- **Risco:** alto para abrir ao público. O aceite é gravado sem texto.
- **Passo a passo:**
  1. O advogado entrega os textos.
  2. Colar em `app/termos/page.tsx` e `app/privacidade/page.tsx`.
  3. Subir `TERMS_VERSION` para 1.1.

**P3. Confirmação de e-mail e captcha (S14, D17)**
- **Risco:** médio. Hoje dá para cadastrar e-mail alheio e abusar do cadastro anônimo.
- **Passo a passo:** no painel do Supabase, Authentication:
  1. Ligar "Confirm email".
  2. Ligar o Turnstile (captcha).
  3. Testar `/conta`.

**P4. CI (C03)**
- **Risco:** baixo.
- **Passo a passo:**
  1. Workflow `.github/workflows/ci.yml` com `pnpm install --frozen-lockfile`, `test`, `lint`, `typecheck`, `build` e `uv run pytest`.
  2. Seu "ok" (CLAUDE.md §7).

**P5. Merge e deploy:** merge da branch na `main`, push e deploy (Vercel + Railway/Fly). Só com o seu pedido.

## 7. Riscos residuais conhecidos
- Worker em instância única: limites em memória e agendador mensal duplicariam com 2 instâncias.
- O limite do `/ingest` por endereço assume que o proxy acrescenta `X-Forwarded-For` (anotado em `docs/DEPLOY.md`).
- Um aviso alto em dependência de desenvolvimento (`braces`), sem correção publicada; não vai para produção.
- Nada foi testado contra o Supabase real depois das mudanças: as migrações estão pendentes.
- Imagem Docker e envio real do coletor nunca foram executados.
