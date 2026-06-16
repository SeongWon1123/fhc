[CmdletBinding()]
param(
    [switch]$NoBuild,
    [switch]$WithModels,
    [switch]$WithAdmin,
    [switch]$Foreground
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI was not found. Install Docker Desktop and retry."
}

& docker compose version | Out-Null

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Warning "Created .env from .env.example. Replace placeholder secrets before using auth-dependent routes."
}

$ComposeArgs = @("compose")
if ($WithModels) {
    $ComposeArgs += @("--profile", "models")
}
if ($WithAdmin) {
    $ComposeArgs += @("--profile", "admin")
}

& docker @($ComposeArgs + @("config", "--quiet"))

$UpArgs = @("up")
if (-not $Foreground) {
    $UpArgs += "-d"
}
if (-not $NoBuild) {
    $UpArgs += "--build"
}

& docker @($ComposeArgs + $UpArgs)
& docker compose ps
