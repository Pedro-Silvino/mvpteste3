# RUN-LOG — Prova Cyber v1 (execução sem supervisão)

Branch: `release/prova-cyber-v1` (a partir de `audit/melhorias-2026-10-21`, 74ab6ac). Data de início: 2026-10-27.

## Onde estamos
- Estado: MVP Sentinela com auditoria concluída, programa de corretores local; nada aplicado no remoto.
- Primeira fase: F0 (linha de base), depois F1 (alinhar produto Prova Cyber à Base 12).
- Bloqueios conhecidos: sem Docker; sem aplicar migração no remoto; sem Asaas/Resend reais; `.claude/settings.json` pede confirmação para push/migração/dependência.

## F0 — Linha de base (2026-10-27)
| Suíte | Resultado |
|---|---|
| web Vitest | 84/84 (17 arquivos) |
| web lint / typecheck / build | ok / ok / ok |
| worker pytest | 134/134 |
| banco (run_local.sh, Postgres 17 local) | 113 verificações `ok`, 0 FAIL |
| base12.json (docs, web, worker) | idênticos (md5 9ca5f260…) |
