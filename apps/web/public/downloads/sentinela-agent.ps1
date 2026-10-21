<#
.SYNOPSIS
  Coletor Sentinela (DataDops). Confere este computador e envia SOMENTE um resumo (sim/nao e contagens).

.DESCRIPTION
  O que confere: antivirus, atualizacoes do Windows, se o usuario e administrador local, se o equipamento e
  portatil e se o disco esta criptografado (BitLocker).
  O que NAO faz: nao le arquivos, nao guarda nem envia senhas, nomes de usuario, e-mails ou o nome do
  computador. O nome do computador vira um codigo (SHA-256) antes de qualquer envio.
  O relatorio completo desta maquina fica numa pasta local (-OutDir) e nunca sai daqui.
  Funciona sem ser administrador: o que exigir permissao maior e enviado como "nao informado".

.PARAMETER Token
  Token do agente gerado no painel Sentinela (comeca com snt_).

.PARAMETER ApiUrl
  Endereco de envio mostrado no painel (termina em /ingest).

.PARAMETER OutDir
  Pasta local onde o relatorio completo desta maquina e salvo. Padrao: Documentos\Sentinela.

.PARAMETER DryRun
  Mostra o que seria enviado e NAO envia nada. Use para conferir antes.

.EXAMPLE
  .\sentinela-agent.ps1 -DryRun

.EXAMPLE
  .\sentinela-agent.ps1 -Token snt_xxx -ApiUrl https://worker.exemplo.com.br/ingest
#>
[CmdletBinding()]
param(
    [string]$Token,
    [string]$ApiUrl,
    [string]$OutDir = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Sentinela'),
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$CollectorVersion = '1.0.0'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Get-Safe {
    # Roda um bloco e devolve $null se falhar (sem permissao, recurso ausente etc.).
    param([scriptblock]$Block)
    try { & $Block } catch { $null }
}

function Get-Sha256Hex {
    param([string]$Text)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text)) | ForEach-Object { $_.ToString('x2') }) -join '' }
    finally { $sha.Dispose() }
}

# --- sistema operacional ---------------------------------------------------------------------------------
$os = Get-Safe { Get-CimInstance Win32_OperatingSystem }
$build = if ($os) { [int]$os.BuildNumber } else { $null }
$osSupported = $null
if ($build -ne $null) {
    if ($build -ge 22000) { $osSupported = $true }                      # Windows 11
    elseif ($build -ge 10240) { $osSupported = ([datetime]::UtcNow -lt [datetime]'2025-10-15') }  # Windows 10: fim do suporte em 14/10/2025
    else { $osSupported = $false }                                       # Windows 8.1 ou mais antigo
}

# --- ultima atualizacao instalada ------------------------------------------------------------------------
$lastUpdateDays = $null
$hotfix = Get-Safe { Get-HotFix | Where-Object { $_.InstalledOn } | Sort-Object InstalledOn -Descending | Select-Object -First 1 }
if ($hotfix) { $lastUpdateDays = [int][math]::Max(0, ([datetime]::Now - $hotfix.InstalledOn).TotalDays) }

# --- antivirus -------------------------------------------------------------------------------------------
$avActive = $null
$avAgeDays = $null
$defender = Get-Safe { Get-MpComputerStatus }
if ($defender -and $defender.AntivirusEnabled -and $defender.RealTimeProtectionEnabled) {
    $avActive = $true
    $avAgeDays = [int]$defender.AntivirusSignatureAge
}
else {
    # Outro antivirus registrado no Centro de Seguranca do Windows (productState: 0x1000 ligado, 0x10 desatualizado).
    $products = Get-Safe { @(Get-CimInstance -Namespace 'root/SecurityCenter2' -ClassName AntiVirusProduct) }
    if ($products -and $products.Count -gt 0) {
        $on = $products | Where-Object { ($_.productState -band 0x1000) -ne 0 } | Select-Object -First 1
        if ($on) {
            $avActive = $true
            $avAgeDays = if (($on.productState -band 0x10) -eq 0) { 0 } else { 30 }
        }
        else { $avActive = $false; $avAgeDays = 0 }
    }
    elseif ($defender) { $avActive = $false; $avAgeDays = 0 }
}

# --- usuario administrador local -------------------------------------------------------------------------
# Verdadeiro quando o usuario do dia a dia pertence ao grupo Administradores (mesmo sem "executar como admin").
$adminSid = New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')
$isLocalAdmin = Get-Safe { [bool]([Security.Principal.WindowsIdentity]::GetCurrent().Groups | Where-Object { $_.Value -eq $adminSid.Value }) }

# --- portatil? -------------------------------------------------------------------------------------------
$isLaptop = $null
$battery = Get-Safe { @(Get-CimInstance Win32_Battery) }
$chassis = Get-Safe { (Get-CimInstance Win32_SystemEnclosure).ChassisTypes }
if ($chassis) { $isLaptop = [bool](@($chassis) | Where-Object { $_ -in 8, 9, 10, 11, 12, 14, 18, 21, 30, 31, 32 }) }
elseif ($battery -ne $null) { $isLaptop = ($battery.Count -gt 0) }

# --- BitLocker (so legivel como administrador; senao fica "nao informado") -------------------------------
$bitlocker = $null
$vol = Get-Safe { Get-BitLockerVolume -MountPoint $env:SystemDrive -ErrorAction Stop }
if ($vol) { $bitlocker = ($vol.ProtectionStatus -eq 'On' -or [int]$vol.ProtectionStatus -eq 1) }

# --- monta o que sera enviado (SO o resumo) --------------------------------------------------------------
$payload = [ordered]@{
    module            = 'windows'
    collector_version = $CollectorVersion
    collected_at      = [datetime]::UtcNow.ToString('o')
    device_ref        = Get-Sha256Hex ([Environment]::MachineName.ToLowerInvariant())
    summary           = [ordered]@{
        machine = [ordered]@{
            os_supported        = $osSupported
            last_update_days    = $lastUpdateDays
            av_active           = $avActive
            av_age_days         = $avAgeDays
            user_is_local_admin = $isLocalAdmin
            is_laptop           = $isLaptop
            bitlocker           = $bitlocker
        }
    }
}
$json = $payload | ConvertTo-Json -Depth 5 -Compress

# --- relatorio completo, so nesta maquina ----------------------------------------------------------------
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$stamp = [datetime]::Now.ToString('yyyyMMdd-HHmmss')
$localFile = Join-Path $OutDir "sentinela-$stamp.json"
$local = [ordered]@{
    aviso_privacidade = 'Este arquivo fica somente neste computador. O Sentinela recebe apenas o campo "enviado".'
    sistema           = if ($os) { $os.Caption } else { $null }
    versao_build      = $build
    enviado           = $payload
}
($local | ConvertTo-Json -Depth 8) | Set-Content -Path $localFile -Encoding UTF8

Write-Host ''
Write-Host 'Sentinela - conferencia deste computador' -ForegroundColor Cyan
Write-Host ('  Sistema com suporte ........ {0}' -f $(if ($osSupported -eq $null) { 'nao informado' } elseif ($osSupported) { 'sim' } else { 'nao' }))
Write-Host ('  Dias desde a atualizacao ... {0}' -f $(if ($lastUpdateDays -eq $null) { 'nao informado' } else { $lastUpdateDays }))
Write-Host ('  Antivirus ativo ............ {0}' -f $(if ($avActive -eq $null) { 'nao informado' } elseif ($avActive) { 'sim' } else { 'nao' }))
Write-Host ('  Usuario e administrador .... {0}' -f $(if ($isLocalAdmin -eq $null) { 'nao informado' } elseif ($isLocalAdmin) { 'sim' } else { 'nao' }))
Write-Host ('  Portatil ................... {0}' -f $(if ($isLaptop -eq $null) { 'nao informado' } elseif ($isLaptop) { 'sim' } else { 'nao' }))
Write-Host ('  Disco criptografado ........ {0}' -f $(if ($bitlocker -eq $null) { 'nao informado (rode como administrador para conferir)' } elseif ($bitlocker) { 'sim' } else { 'nao' }))
Write-Host ('  Relatorio completo salvo em  {0}' -f $localFile)

if ($DryRun) {
    Write-Host ''
    Write-Host 'MODO TESTE: nada foi enviado. Este e o resumo que seria enviado:' -ForegroundColor Yellow
    Write-Output $json
    return
}

if (-not $Token -or $Token -notmatch '^snt_[a-f0-9]{64}$') { throw 'Informe o -Token gerado no painel Sentinela (comeca com snt_).' }
if (-not $ApiUrl -or $ApiUrl -notmatch '^https://') { throw 'Informe o -ApiUrl mostrado no painel Sentinela (precisa comecar com https://).' }

try {
    Invoke-RestMethod -Method Post -Uri $ApiUrl -Headers @{ Authorization = "Bearer $Token" } `
        -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($json)) -TimeoutSec 30 | Out-Null
    Write-Host ''
    Write-Host 'Resumo enviado com sucesso. O painel Sentinela atualiza em instantes.' -ForegroundColor Green
}
catch {
    $status = $null
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    switch ($status) {
        401 { throw 'Token invalido, expirado ou revogado. Gere um novo no painel Sentinela.' }
        429 { throw 'Muitos envios seguidos. Tente de novo mais tarde (limite de 10 por hora por token).' }
        422 { throw 'O resumo foi recusado pelo Sentinela. Baixe a versao mais recente do coletor.' }
        default { throw ('Nao foi possivel enviar o resumo (codigo {0}). Confira a internet e o -ApiUrl.' -f $status) }
    }
}
