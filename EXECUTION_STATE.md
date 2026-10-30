# EXECUTION_STATE — Sentinela CAT-TPRM

Estado dos 5 ciclos. Marcar `[x]` só com testes passando.

- [x] **Ciclo 1** — migração `20261030000000_cat_tprm_core.sql` (NÃO aplicada no remoto) + `supabase/tests/03_worm_vault_test.sql` (48 verificações ok)
- [x] **Ciclo 2** — ASM de portas (com autorização `scan_ativo`), DMARC estrito, conector M365, webhooks; pytest 161 ok. Falta ligar ao runner (precisa de telas)
- [ ] **Ciclo 3** — API do cofre, parser de questionários, matcher determinístico, UI
- [ ] **Ciclo 4** — portal do fornecedor `/fornecedor/[token]`, Score TPRM, reavaliação periódica
- [ ] **Ciclo 5** — dossiê de ciberseguro (PDF + SHA-256), console MSP, validação final

## Definition of Done (rodar no fim)
- [ ] `pnpm --filter web typecheck`
- [ ] `pnpm --filter web lint`
- [ ] `pnpm --filter web test`
- [ ] `cd worker && uv run pytest -v`
- [ ] `pnpm --filter web build`
