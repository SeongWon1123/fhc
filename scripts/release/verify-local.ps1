[CmdletBinding()]
param(
  [switch]$SkipInstall,
  [switch]$SkipDocker
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..\..")

function Invoke-Native {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string[]]$Arguments = @()
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
  }
}

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$WorkingDirectory,
    [Parameter(Mandatory = $true)][scriptblock]$Command
  )

  Write-Host "==> $Name"
  Push-Location $WorkingDirectory
  try {
    & $Command
  } finally {
    Pop-Location
  }
}

Invoke-Step "Web lint and build" (Join-Path $repoRoot "apps\web") {
  if (-not $SkipInstall) { Invoke-Native "npm" @("ci") }
  Invoke-Native "npm" @("run", "lint")
  Invoke-Native "npm" @("run", "build")
}

Invoke-Step "Mobile typecheck" (Join-Path $repoRoot "apps\mobile") {
  if (-not $SkipInstall) { Invoke-Native "npm" @("ci") }
  Invoke-Native "npm" @("run", "typecheck")
}

Invoke-Step "FastAPI compile" $repoRoot {
  Invoke-Native "python" @("-m", "compileall", "-q", "services\api-fastapi")
}

Invoke-Step "BFF syntax" (Join-Path $repoRoot "services\api-node") {
  if (-not $SkipInstall) { Invoke-Native "npm" @("ci") }
  Invoke-Native "npm" @("run", "syntax")
}

if (-not $SkipDocker) {
  Invoke-Step "Docker Compose config" $repoRoot {
    Invoke-Native "docker" @("compose", "-f", "docker-compose.yml", "config", "--quiet")
  }
}

Write-Host "All local release checks passed."
