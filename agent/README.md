# Coletor Sentinela (para a TI da empresa)

Programa pequeno que confere **este computador** e envia ao Sentinela só um **resumo** (sim/não e contagens).
Com ele, o diagnóstico deixa de depender só do que foi respondido e passa a mostrar o que foi realmente verificado.

## O que ele confere
| Item | Como |
|---|---|
| Sistema operacional com suporte | versão do Windows |
| Atualizações em dia | data da última atualização instalada |
| Antivírus ligado e atualizado | Windows Defender ou o antivírus registrado no Windows |
| Usuário é administrador | o usuário que está logado pertence ao grupo Administradores |
| Equipamento é portátil | tipo de gabinete / bateria |
| Disco criptografado (BitLocker) | só consegue ler se rodar como administrador; senão envia "não informado" |

## O que ele NÃO faz
- Não lê arquivos, e-mails nem documentos.
- Não envia senhas, nomes de usuário, e-mails ou o **nome do computador**. O nome vira um código (SHA-256) no próprio computador.
- Não instala nada e não fica rodando em segundo plano.
- O relatório completo desta máquina fica numa pasta local (`Documentos\Sentinela`) e não sai dela.

## Como usar (5 minutos por computador)
1. No painel Sentinela, abra **Coletor**, gere um token e copie o comando mostrado (o token aparece **uma única vez**).
2. Baixe `sentinela-agent.ps1` e confira o código de verificação mostrado no painel:
   ```powershell
   Get-FileHash .\sentinela-agent.ps1 -Algorithm SHA256
   ```
   O valor precisa ser igual ao do painel.
3. Teste antes de enviar (não envia nada):
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\sentinela-agent.ps1 -DryRun
   ```
4. Envie de verdade, com o comando do painel:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\sentinela-agent.ps1 -Token snt_... -ApiUrl https://.../ingest
   ```
5. Repita em cada computador. Para conferir o BitLocker, rode o PowerShell **como administrador**.

Quantas vezes: o limite é de 10 envios por hora por token. Um token serve para vários computadores.

## Se der erro
| Mensagem | O que fazer |
|---|---|
| Token inválido, expirado ou revogado | gere outro no painel |
| Muitos envios seguidos | espere e tente de novo |
| O resumo foi recusado | baixe a versão mais recente do coletor |
| Não foi possível enviar | confira a internet e o endereço (`-ApiUrl`) |

## Microsoft 365 (opcional)
O Sentinela também aceita um resumo do Microsoft 365 (quantos usuários têm verificação em duas etapas e quantos administradores globais existem), sem nomes. A coleta é feita pela TI com a ferramenta Maester; a integração automática ainda não está no coletor. Fale com a equipe DataDops.

## Para a equipe DataDops
- O que o script envia é exatamente o que o worker aceita: `worker/tests/test_agent_contract.py` confere os campos.
- O arquivo é salvo em UTF-8 **com BOM** de propósito, para o Windows PowerShell 5.1 ler os acentos.
- Depois de qualquer mudança no script: copiar para `apps/web/public/downloads/` e atualizar `AGENT_SHA256` em `apps/web/lib/agent-info.ts` (o teste do web avisa se esquecer).
