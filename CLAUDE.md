# CLAUDE.md — Sentinela (MVP DataDops)

Você é o engenheiro deste repositório. O dono é Pedro Silvino (DataDops). Ele é desenvolvedor, mas quer explicações **curtas, simples e em tópicos**. Sem textão.

---

## 0. Protocolo de sessão (OBRIGATÓRIO)

Este projeto é construído em várias conversas. A memória entre elas fica nos arquivos, não no chat.

**Ao começar qualquer sessão:**
1. Leia `docs/HISTORICO.md` (só as 3 últimas entradas) e `docs/TAREFAS.md`.
2. Diga em 3 linhas: onde paramos, qual é a próxima tarefa e se há bloqueio.
3. Só então comece.

**Ao terminar cada tarefa:**
1. Marque `[x]` em `docs/TAREFAS.md`.
2. Adicione uma entrada no **topo** de `docs/HISTORICO.md` (modelo no próprio arquivo).
3. Se tomou uma decisão de arquitetura, registre em `docs/DECISOES.md`.
4. Faça commit (mensagem curta em português, prefixo `feat:`, `fix:`, `db:`, `docs:`).

**Quando a conversa ficar longa** (mais de ~3 tarefas concluídas, respostas lentas ou você começar a esquecer detalhes):
- Rode o protocolo de fim (`/fim`) e diga: **"Pode abrir um chat novo e digitar /inicio."**

Comandos prontos em `.claude/commands/`: `/inicio`, `/fim`, `/tarefa`.

---

## 1. O que é o produto

**Sentinela** é a plataforma da DataDops que:
1. faz um diagnóstico de segurança de PMEs (questionário em linguagem de dono + scans automáticos);
2. gera um relatório em PDF com a identidade DataDops;
3. repete a verificação todo mês e alerta quando algo piora.

Base de tudo: a **Base 12** (`docs/BASE12.json`), 12 controles mínimos. Um mesmo conjunto de evidências serve para: questionário de seguradora, questionário de cliente grande, LGPD (art. 46) e parte do Provimento CNJ 213.

Fluxo completo e experiência do cliente: `docs/PRODUTO.md`. **Leia antes de criar qualquer tela.**

---

## 2. Stack (não trocar sem registrar em DECISOES.md)

| Parte | Tecnologia | Pasta |
|---|---|---|
| Portal (cliente + staff) | Next.js 15 (App Router) + TypeScript + Tailwind | `apps/web` |
| Banco, login, arquivos | Supabase (Postgres + Auth + Storage), região **sa-east-1** | `supabase/` |
| Scans e relatórios | Python 3.12 + FastAPI + Playwright (PDF) em container | `worker/` |
| Agente no cliente | PowerShell 5.1+ (Windows) + Maester (M365) | `agent/` |
| Cobrança | Asaas (assinatura + split) — semana 3 | `apps/web` (rota server) |
| Hospedagem | Vercel (web) + Railway ou Fly.io (worker) | — |

Gerenciador de pacotes: `pnpm` (web) e `uv` (worker).

---

## 3. Supabase

- Projeto **novo**, nome `sentinela-mvp`, região `sa-east-1`. **Não mexa** nos projetos antigos (Dops, Sentinela-dops, sentinelaclaude): estão pausados e ficam assim.
- O **único** projeto Supabase remoto permitido é o `sentinela-mvp` (ref `gcysfzzpiwospnmwkcar`). Os demais projetos da conta nunca devem ser usados (nem leitura, nem MCP, nem CLI). Confira o ref antes de qualquer chamada.
- Toda mudança de banco é uma **migração** em `supabase/migrations/` (Supabase CLI). Nunca altere o banco remoto "na mão".
- Antes de aplicar no remoto: mostre o SQL ao Pedro e espere o "ok".
- Histórico local alinhado com o remoto: `20260925142248_init.sql` e `20260928142523_fix_security_definer_execute_grants.sql`, já aplicadas. Nova mudança: `supabase migration new <nome>`, mostrar o SQL ao Pedro e só aplicar após o "ok"; depois rodar `get_advisors` (segurança).
- Gere os tipos TS após cada migração: `supabase gen types typescript --linked > apps/web/lib/database.types.ts`.

---

## 4. Regras de segurança (inegociáveis)

Somos uma empresa de segurança. Uma falha aqui mata o negócio.

1. **RLS ligado em toda tabela.** Sem exceção. Tabela nova sem política = tarefa não concluída.
2. **Service role só no servidor** (worker e rotas server do Next). Nunca no navegador, nunca com prefixo `NEXT_PUBLIC_`.
3. **Nunca guardar senha ou credencial de cliente.** O agente roda no ambiente do cliente e envia só resultado + hash.
4. **Minimizar dados pessoais.** Guardar contagens ("12 de 40 usuários sem MFA"), não listas de nomes/e-mails.
5. Toda evidência recebida tem **SHA-256** gravado. Todo relatório gerado tem SHA-256 gravado.
6. **Token do agente:** gerado uma vez, mostrado uma vez, guardado só o hash, com validade e revogação.
7. Segredos só em variáveis de ambiente (`.env.local`, nunca commitado). Manter `.env.example` atualizado. **Nunca leia nem imprima o conteúdo de `.env`** no chat ou em log.
8. Toda ação sensível grava em `audit_log`.
9. Validação de entrada com Zod (web) e Pydantic (worker). Nada de SQL concatenado.
10. Scan externo do diagnóstico gratuito = **somente consultas públicas** (DNS, certificado, cabeçalhos HTTP da página inicial). **Varredura de portas só com autorização assinada** (`authorizations.tipo = 'scan_ativo'`).
11. Dependências com versão fixa. Dependabot ligado.
12. Buckets do Storage **privados**; acesso por URL assinada de curta duração.
13. Nunca use dado real de cliente em teste, fixture ou log (nem credencial, nem nome, nem e-mail).
14. Nunca desative ou enfraqueça teste, lint, RLS ou checagem de segurança para fazer o build passar.
15. Nunca faça `push --force` nem `reset --hard` (já bloqueados em `.claude/settings.json`); deploy e merge na `main` só quando o Pedro pedir explicitamente.
16. Rate limit em rotas públicas (ex.: login, diagnóstico gratuito).
17. Erro genérico para o cliente; stack trace e dado pessoal só em log interno.

---

## 5. Regras de texto (jurídico e marca)

O portal e os relatórios são lidos por clientes, corretores e seguradoras.

**Nunca escrever:** "empresa segura", "100% seguro", "risco zero", "certificado/certificação" (para o diagnóstico), "garantia de aceitação", "desconto no seguro", "blindagem", "transferimos sua responsabilidade", "seguro técnico".

**Usar:**
- "controles verificados", "evidência registrada em DD/MM/AAAA", "nota de maturidade".
- Selo **Autoavaliado**: respostas declaradas pela empresa + checagens automáticas.
- Selo **Verificado**: evidências revisadas pela equipe DataDops.
- Rodapé de todo relatório: *"Retrato do ambiente na data da coleta. Não substitui análise jurídica nem garante aceitação ou indenização por seguradora. As declarações feitas à seguradora são de responsabilidade da empresa."*
- DataDops **não é corretora nem seguradora**.
- Grupo ProHD: "laboratório próprio", "no mercado desde 1999". **Nunca** citar credenciamento ou aceitação por tribunais. **Nunca** oferecer recuperação de celular.
- **Não exibir preços** no portal enquanto `docs/DECISOES.md` não definir. Usar "Proposta sob medida".

---

## 6. Identidade visual

- Cores: `--n1 #051623` (fundo escuro), `--n3 #12324A`, `--teal #4290AE`, `--sky #89D1E2`, `--ice #D8EEF5`, texto `#051623`, cinza `#52606F`, borda `#E1E8ED`.
- Fontes: **Archivo** (títulos) e **Hanken Grotesk** (texto), via Google Fonts.
- Tom: direto, sem jargão. Termo técnico sempre com explicação em uma linha.
- O relatório PDF segue o mesmo visual (template HTML em `worker/templates/`).

---

## 7. Como trabalhar

- **Uma tarefa por vez**, na ordem de `docs/TAREFAS.md`. Não pule nem adiante tarefa de outra semana.
- Antes de codar: diga em até 5 tópicos o plano. Depois execute.
- **TDD:** escreva o teste primeiro, veja falhar, implemente o mínimo para passar, depois refatore com o teste verde. Toda função de regra (nota, mapeamento de scan → controle) tem **teste** (Vitest no web, pytest no worker). Antes de dizer que terminou, rode os testes (e lint/typecheck onde existir) e mostre a saída.
- Não crie abstração "para o futuro". Código simples, legível, em inglês; textos de interface em português.
- Se algo exigir decisão do Pedro (preço, texto jurídico, fornecedor pago), **pare e pergunte** em uma linha.
- **Sempre pergunte antes de:** `git push`, abrir ou mergear PR; instalar dependência nova (diga o pacote e o motivo); criar ou alterar migração, política RLS (ver §3), autenticação ou cobrança; alterar CI (`.github/`), `package.json` ou middleware. As permissões técnicas desses pontos de parada estão em `.claude/settings.json` (`ask`/`deny`); esta lista é a versão em prosa, para não depender só da ferramenta.
- **Branch por tarefa só no ciclo automatizado** (skill `/proxima-issue` com os subagentes `implementador`, `validador` e `auditor-seguranca`): cada tarefa numa branch `feat/<n>-<slug>`, commits semânticos (`feat:`, `fix:`, `test:`, `refactor:`, `security:`); só o Pedro marca `[x]` em `docs/TAREFAS.md`, depois do merge. No fluxo manual (`/tarefa`, você e o Pedro na mesma conversa) continua valendo o §0: commit direto, mensagem curta em português, você mesmo marca `[x]` ao terminar.
- Ao terminar, explique o resultado em até 5 tópicos e diga como testar.

---

## 8. Estrutura do repositório

```
apps/web/            Portal Next.js
worker/              FastAPI: scans, orquestrador, relatório PDF
  app/scans/         external.py, m365_import.py, windows_import.py
  app/engine/        scoring.py, mapping.py, diff.py
  templates/         relatorio.html (identidade DataDops)
agent/               sentinela-agent.ps1 + README para a TI do cliente
supabase/migrations/ SQL versionado
docs/
  PRODUTO.md         fluxo, telas, experiência do cliente
  BASE12.json        controles, perguntas, pesos, mapeamentos
  TAREFAS.md         backlog com critérios de aceite
  HISTORICO.md       diário das sessões (memória do projeto)
  DECISOES.md        decisões tomadas e por quê
.claude/commands/    /inicio  /fim  /tarefa
```
