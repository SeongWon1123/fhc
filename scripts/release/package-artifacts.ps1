[CmdletBinding()]
param(
  [string]$Version = $env:RELEASE_VERSION,
  [ValidateSet("staging", "prod", "production")]
  [string]$Stage = $(if ($env:RELEASE_STAGE) { $env:RELEASE_STAGE } else { "staging" }),
  [string]$OutputDir = $env:RELEASE_OUTPUT_DIR
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..\..")

function Invoke-OptionalGit {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  $previousLastExitCode = $global:LASTEXITCODE

  try {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $output = & git -C $repoRoot @Arguments 2>$null
    $exitCode = $LASTEXITCODE
  } catch {
    $output = $null
    $exitCode = 1
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
    $global:LASTEXITCODE = $previousLastExitCode
  }

  if ($exitCode -eq 0 -and $output) {
    return ($output -join "`n").Trim()
  }

  return $null
}

if (-not $OutputDir) {
  $OutputDir = Join-Path $repoRoot "dist\release"
}

if (-not $Version) {
  $tag = Invoke-OptionalGit @("describe", "--tags", "--exact-match")
  if ($tag) {
    $Version = $tag
  } else {
    $Version = "dev-$([DateTime]::UtcNow.ToString("yyyyMMddHHmmss"))"
  }
}

$safeVersion = $Version -replace "[\\/]", "-"
$packageName = "fitconnect-$safeVersion-$Stage"
$stagingDir = Join-Path $OutputDir $packageName
$archivePath = Join-Path $OutputDir "$packageName.zip"
$manifestPath = Join-Path $stagingDir "RELEASE_MANIFEST.txt"

Remove-Item -LiteralPath $stagingDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

function Copy-ReleasePath {
  param([Parameter(Mandatory = $true)][string]$RelativePath)

  $source = Join-Path $repoRoot $RelativePath
  if (-not (Test-Path -LiteralPath $source)) {
    return
  }

  $target = Join-Path $stagingDir $RelativePath
  $targetParent = Split-Path -Parent $target
  New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Recurse -Force
}

@(
  ".env.example",
  "docker-compose.yml",
  "nginx",
  "infra\data\README.md",
  "infra\data\templates",
  "infra\scripts",
  "infra\supabase",
  "docs\RELEASE_RUNBOOK.md",
  "docs\QA_RELEASE_CHECKLIST.md",
  "apps\web\Dockerfile",
  "apps\web\nginx.conf",
  "apps\web\package.json",
  "apps\web\package-lock.json",
  "apps\web\index.html",
  "apps\web\public",
  "apps\web\src",
  "apps\web\tsconfig.json",
  "apps\web\tsconfig.app.json",
  "apps\web\tsconfig.node.json",
  "apps\web\vite.config.ts",
  "apps\web\eslint.config.js",
  "services\api-fastapi\Dockerfile",
  "services\api-fastapi\requirements.txt",
  "services\api-fastapi\main.py",
  "services\api-fastapi\app",
  "services\api-node\Dockerfile",
  "services\api-node\package.json",
  "services\api-node\package-lock.json",
  "services\api-node\index.js",
  "services\api-node\routes",
  "services\api-node\middleware",
  "scripts\release"
) | ForEach-Object { Copy-ReleasePath $_ }

$commit = Invoke-OptionalGit @("rev-parse", "--verify", "HEAD")
if (-not $commit) { $commit = "unknown" }

$files = Get-ChildItem -LiteralPath $stagingDir -File -Recurse |
  Where-Object { $_.FullName -ne $manifestPath } |
  ForEach-Object { $_.FullName.Substring($stagingDir.Length + 1) } |
  Sort-Object

@(
  "name=$packageName",
  "version=$Version",
  "stage=$Stage",
  "created_utc=$([DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"))",
  "commit=$commit",
  "",
  "contents:"
) + $files | Set-Content -Path $manifestPath -Encoding UTF8

Compress-Archive -LiteralPath $stagingDir -DestinationPath $archivePath -Force

Write-Host "Created $archivePath"
Write-Host "Created $manifestPath"

$global:LASTEXITCODE = 0
