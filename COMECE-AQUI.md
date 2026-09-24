# Comece aqui (para o Pedro)

**1. Preparar (uma vez)**
- Descompacte esta pasta onde ficam seus projetos.
- Abra a pasta no VS Code.
- Instale se faltar: Node 22+, pnpm, Python 3.12, uv, Supabase CLI, Git.
- No terminal: `git init && git add . && git commit -m "docs: kit inicial"`.
- Crie um repositório **privado** no GitHub e faça o push. Ligue MFA no GitHub, Supabase, Vercel e Railway.

**2. Conectar o Supabase ao Claude**
- Opção simples: no terminal, `supabase login` → o Claude usa a CLI.
- Opcional: adicionar o MCP do Supabase na extensão do Claude (modo somente leitura para consultas).

**3. Trabalhar**
- Abra o Claude na extensão do VS Code, na raiz desta pasta.
- Digite `/inicio`. Ele diz onde paramos e o plano. Responda "vai".
- Para cada tarefa: `/tarefa` (ou `/tarefa T05`).
- Quando o chat ficar pesado (ou ele pedir): `/fim` e abra um chat novo com `/inicio`.

**4. Regras que você cobra dele**
- Mostrar o SQL antes de aplicar no Supabase remoto.
- Uma tarefa por vez, com teste.
- Nunca exibir preço, nunca "empresa segura", nunca guardar senha de cliente.

**5. O que só você faz**
- Aprovar o visual do PDF (T07).
- Textos jurídicos, modelos de documento e preços (lista no fim de `docs/TAREFAS.md`).
- Apontar o DNS de `app.datadops.com.br`.
