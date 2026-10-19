# DECISÕES

Formato: número, data, decisão, porquê. Para mudar uma decisão, crie uma nova que substitui a antiga (não apague).

| # | Data | Decisão | Porquê |
|---|---|---|---|
| D01 | 2026-09-24 | Projeto novo, do zero. Do Sentinela antigo só se copiam peças (login, Asaas, pipeline PDF, identidade). | O Sentinela foi desenhado para saúde/TCLE; adaptar custa mais que refazer. |
| D02 | 2026-09-24 | Supabase novo `sentinela-mvp` em sa-east-1. Projetos antigos ficam pausados. | Dados no Brasil; banco limpo. |
| D03 | 2026-09-24 | Next.js + Supabase no portal; Python no worker. | Stack que o Pedro já domina; Python tem as melhores bibliotecas de DNS/TLS e roda Playwright. |
| D04 | 2026-09-24 | Agente roda no cliente e envia só resumo + SHA-256. Evidência completa fica numa pasta do próprio cliente. | Não guardar credencial nem dado pessoal reduz o risco e a responsabilidade da DataDops. |
| D05 | 2026-09-24 | Login por e-mail com código (OTP), sem senha. | Menos atrito para o dono de PME; sem senha para vazar. |
| D06 | 2026-09-24 | Escritas sensíveis só via funções (RPC) com `security definer`; worker usa service role. | Regra de acesso fica no banco, não espalhada no código. |
| D07 | 2026-09-24 | Scan tem prioridade sobre resposta; "Não sei" = sem_dado = 0 na nota. | Evidência vale mais que declaração; "não sei" vira tarefa, não mentira. |
| D08 | 2026-09-24 | Diagnóstico gratuito só faz consultas públicas (DNS, TLS, cabeçalhos). Varredura de portas só com autorização `scan_ativo`. | Segurança jurídica: não testar sistema de terceiro sem autorização. |
| D09 | 2026-09-24 | Não usar Probo nem compliance-framework no MVP. Reavaliar Probo (MIT) depois de 3 clientes. compliance-framework é AGPL: só referência. | Velocidade de lançamento; evitar obrigação de abrir código. |
| D10 | 2026-09-24 | Sem preços no portal até decisão do Pedro. | Preços em validação. |
| D11 | 2026-09-24 | Google Workspace fora do MVP; entra se um cliente pagante usar. | Foco em M365 + Windows, que cobrem a maioria das PMEs atendidas. |
| D12 | 2026-10-08 | Os 9 avisos `authenticated_security_definer_function_executable` (WARN) do advisor são intencionais: `create_organization`, `create_agent_token`, `revoke_agent_token`, `submit_assessment`, `approve_document`, `staff_review_control` são RPCs chamadas pelo app; `is_member`, `has_role`, `is_staff` são usadas pelas políticas de RLS. Manter `EXECUTE` para `authenticated`. | Segue a D06 (escritas sensíveis via RPC). Cada função valida permissão internamente; revogar quebraria o app e o RLS. Reavaliar na T22. |
| D13 | 2026-10-19 | Rate limit do login = limite nativo do Supabase Auth para e-mails OTP; cadastro limitado a 3 empresas por conta (`create_organization`). Sem rate limit próprio no MVP. | Supabase já barra envio repetido de código; evita infraestrutura extra (Redis). Reavaliar antes do diagnóstico público aberto (T08/T22). |
| D14 | 2026-10-19 | CNPJ só numérico (validação de dígito no web; coluna `^[0-9]{14}$`). CNPJ alfanumérico (Receita, a partir de jul/2026) exige migração futura (coluna + `regexp_replace` em `create_organization`). | Banco atual rejeita letras; mudar exige migração aprovada pelo Pedro. |
| D15 | 2026-10-19 | Server action repassa o IP do usuário (`x-forwarded-for` da Vercel) para o Supabase, para `request_ip()` gravar o IP do aceite e não o do servidor. | LGPD/prova de aceite: o IP precisa ser do cliente. Conferir no 1º cadastro real que `authorizations.ip` não é IP da Vercel. |
