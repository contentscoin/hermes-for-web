param(
  [switch]$Yes,
  [int]$Port = 8788,
  [string]$RepoUrl = "https://github.com/reallygood83/hermes-for-web.git",
  [string]$InstallDir = "$env:USERPROFILE\.hermes\webui\workspace\hermes-for-web"
)
$ErrorActionPreference = "Stop"
function Step($m){ Write-Host "`n==> $m" -ForegroundColor Cyan }
function Need($cmd){ if(-not (Get-Command $cmd -ErrorAction SilentlyContinue)){ throw "Missing required command: $cmd" } }

Step "Prerequisites"
Need git
Need python
if(-not (Get-Command hermes -ErrorAction SilentlyContinue)){
  Write-Warning "Hermes CLI not found. Install Hermes Agent first, then rerun this script."
  Write-Host "Recommended: follow NousResearch/hermes-agent Windows/WSL2 install guide."
} else {
  Write-Host "Hermes CLI found: $((Get-Command hermes).Source)"
  try { hermes update } catch { Write-Warning "hermes update failed; continuing" }
}

Step "Clone/update Hermes for Web"
$parent = Split-Path $InstallDir -Parent
New-Item -ItemType Directory -Force -Path $parent | Out-Null
if(Test-Path (Join-Path $InstallDir ".git")){
  git -C $InstallDir pull --ff-only
} else {
  git clone $RepoUrl $InstallDir
}

Step "Create launcher"
$bin = "$env:USERPROFILE\.hermes\bin"
New-Item -ItemType Directory -Force -Path $bin | Out-Null
$launcher = Join-Path $bin "hermes-ceo-console.ps1"
@"
Set-Location "$InstallDir"
`$env:HERMES_WEBUI_PORT="$Port"
Start-Process "http://127.0.0.1:$Port"
python server.py --port $Port
"@ | Set-Content -Encoding UTF8 $launcher

Step "Create Desktop shortcut"
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop "Hermes CEO Console.lnk"
$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$launcher`""
$shortcut.WorkingDirectory = $InstallDir
$shortcut.IconLocation = "powershell.exe,0"
$shortcut.Save()

Step "Integration reminders"
Write-Host "Telegram: configure Hermes Agent Telegram integration locally; do not share tokens."
Write-Host "Codex CLI: install/check Codex CLI, then run: codex login"
Write-Host "Paperclip: configure PAPERCLIP_WEB_URL for the live WebUI tab, plus PAPERCLIP_BASE_URL and PAPERCLIP_DEFAULT_COMPANY for MCP/API work."

Step "Start WebUI"
Start-Process powershell.exe -ArgumentList "-ExecutionPolicy Bypass -File `"$launcher`""
Start-Sleep -Seconds 4
try {
  Invoke-RestMethod "http://127.0.0.1:$Port/health" | ConvertTo-Json
  Start-Process "http://127.0.0.1:$Port"
} catch {
  Write-Warning "Health check failed. Open a new PowerShell and run: $launcher"
}
Write-Host "Done. Shortcut: $shortcutPath"
Write-Host "URL: http://127.0.0.1:$Port"
