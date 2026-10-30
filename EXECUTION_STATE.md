# EXECUTION_STATE — Sentinela CAT-TPRM

Estado dos 5 ciclos. Marcar `[x]` só com testes passando.

- [x] **Ciclo 1** — migração `20261030000000_cat_tprm_core.sql` (NÃO aplicada no remoto) + `supabase/tests/03_worm_vault_test.sql` (48 verificações ok)
- [x] **Ciclo 2** — ASM de portas (com autorização `scan_ativo`), DMARC estrito, conector M365, webhooks; pytest 161 ok. Falta ligar ao runner (precisa de telas)
- [x] **Ciclo 3** — API do cofre, parser, matcher determinístico e telas; web 113 testes, lint, typecheck e build ok
- [x] **Ciclo 4** — portal do fornecedor, Score TPRM, reavaliação; worker 181 testes, web 119, build ok. Faltam telas da contratante e agendador
- [x] **Ciclo 5** — dossiê PDF (2 páginas, SHA-256 no rodapé) e console MSP; validação final ok. Falta ligar o dossiê ao job e ao painel

## Definition of Done (rodar no fim)
- [x] `pnpm --filter web typecheck`
- [x] `pnpm --filter web lint`
- [x] `pnpm --filter web test` (126)
- [x] `cd worker && uv run pytest -v` (192)
- [x] `pnpm --filter web build`
