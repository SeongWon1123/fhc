param(
  [string]$OutputDir = "docs/legal/evidence",
  [string[]]$IncludePaths = @(
    "apps",
    "services",
    "infra",
    "nginx",
    "docker-compose.yml",
    ".env.example",
    "README.md",
    "*.ps1"
  )
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  $current = (Get-Location).Path
  while ($current) {
    if (Test-Path -LiteralPath (Join-Path $current ".git")) {
      return $current
    }
    $parent = Split-Path -Parent $current
    if ($parent -eq $current) {
      break
    }
    $current = $parent
  }
  return (Get-Location).Path
}

function Get-RelativePath {
  param(
    [string]$BasePath,
    [string]$TargetPath
  )

  $baseResolved = (Resolve-Path -LiteralPath $BasePath).Path.TrimEnd("\", "/")
  $targetResolved = (Resolve-Path -LiteralPath $TargetPath).Path
  $baseUri = [Uri]($baseResolved + [System.IO.Path]::DirectorySeparatorChar)
  $targetUri = [Uri]$targetResolved
  return [Uri]::UnescapeDataString($baseUri.MakeRelativeUri($targetUri).ToString()).Replace("/", [System.IO.Path]::DirectorySeparatorChar)
}

function Test-Wildcard {
  param([string]$Path)
  return [System.Management.Automation.WildcardPattern]::ContainsWildcardCharacters($Path)
}

function Test-ExcludedPath {
  param([string]$RelativePath)

  $excludedDirs = @(
    ".git",
    ".sisyphus",
    "node_modules",
    "dist",
    "build",
    ".expo",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    "coverage",
    ".next",
    ".turbo"
  )
  $excludedFiles = @(
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    "*.pem",
    "*.key",
    "*.p12",
    "*.pfx",
    "*.sqlite",
    "*.db",
    "*.log"
  )

  $segments = $RelativePath -split "[\\/]+"
  foreach ($segment in $segments) {
    if ($excludedDirs -contains $segment) {
      return $true
    }
  }

  $leaf = Split-Path -Leaf $RelativePath
  foreach ($pattern in $excludedFiles) {
    if ($leaf -like $pattern) {
      return $true
    }
  }

  return $false
}

function Add-DependencyRowsFromPackageJson {
  param(
    [string]$ManifestPath,
    [System.Collections.Generic.List[object]]$Rows,
    [string]$RepoRoot
  )

  $json = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
  $relativeManifest = Get-RelativePath -BasePath $RepoRoot -TargetPath $ManifestPath
  $sections = @("dependencies", "devDependencies", "peerDependencies", "optionalDependencies")

  foreach ($section in $sections) {
    $node = $json.$section
    if ($null -eq $node) {
      continue
    }

    foreach ($property in $node.PSObject.Properties) {
      $Rows.Add([pscustomobject]@{
        Ecosystem = "npm"
        Manifest = $relativeManifest
        DependencyType = $section
        Name = $property.Name
        DeclaredVersion = [string]$property.Value
        License = "TEAM_TO_VERIFY"
        SourceUrl = "TEAM_TO_VERIFY"
        Evidence = "TEAM_TO_ATTACH"
      })
    }
  }
}

function Add-DependencyRowsFromRequirements {
  param(
    [string]$RequirementsPath,
    [System.Collections.Generic.List[object]]$Rows,
    [string]$RepoRoot
  )

  $relativeManifest = Get-RelativePath -BasePath $RepoRoot -TargetPath $RequirementsPath
  $lines = Get-Content -LiteralPath $RequirementsPath

  foreach ($line in $lines) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#") -or $trimmed.StartsWith("-")) {
      continue
    }

    $withoutComment = ($trimmed -split "\s+#", 2)[0].Trim()
    if ($withoutComment -match "^([A-Za-z0-9_.-]+)(.*)$") {
      $Rows.Add([pscustomobject]@{
        Ecosystem = "pip"
        Manifest = $relativeManifest
        DependencyType = "requirements"
        Name = $Matches[1]
        DeclaredVersion = $Matches[2].Trim()
        License = "TEAM_TO_VERIFY"
        SourceUrl = "TEAM_TO_VERIFY"
        Evidence = "TEAM_TO_ATTACH"
      })
    }
  }
}

$repoRoot = Get-RepoRoot
Set-Location -LiteralPath $repoRoot

$resolvedOutputDir = Join-Path $repoRoot $OutputDir
New-Item -ItemType Directory -Force -Path $resolvedOutputDir | Out-Null

$fileMap = @{}

foreach ($include in $IncludePaths) {
  $items = @()
  if (Test-Wildcard -Path $include) {
    $items = Get-Item -Path $include -ErrorAction SilentlyContinue
  } elseif (Test-Path -LiteralPath $include) {
    $items = @(Get-Item -LiteralPath $include)
  }

  foreach ($item in $items) {
    if ($item.PSIsContainer) {
      $children = Get-ChildItem -LiteralPath $item.FullName -Recurse -File -Force
      foreach ($child in $children) {
        $relative = Get-RelativePath -BasePath $repoRoot -TargetPath $child.FullName
        if (-not (Test-ExcludedPath -RelativePath $relative)) {
          $fileMap[$child.FullName] = $child
        }
      }
    } else {
      $relative = Get-RelativePath -BasePath $repoRoot -TargetPath $item.FullName
      if (-not (Test-ExcludedPath -RelativePath $relative)) {
        $fileMap[$item.FullName] = $item
      }
    }
  }
}

$inventoryRows = New-Object System.Collections.Generic.List[object]

foreach ($file in ($fileMap.Values | Sort-Object FullName)) {
  $relative = Get-RelativePath -BasePath $repoRoot -TargetPath $file.FullName
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash.ToLowerInvariant()
  $inventoryRows.Add([pscustomobject]@{
    RelativePath = $relative
    SizeBytes = $file.Length
    LastWriteTimeUtc = $file.LastWriteTimeUtc.ToString("o")
    Sha256 = $hash
  })
}

$sourceInventoryPath = Join-Path $resolvedOutputDir "source_package_inventory.csv"
$hashManifestPath = Join-Path $resolvedOutputDir "hash_manifest.sha256"
$dependencyInventoryPath = Join-Path $resolvedOutputDir "dependency_inventory.csv"
$licenseEvidencePath = Join-Path $resolvedOutputDir "open_source_license_evidence.md"
$snapshotPath = Join-Path $resolvedOutputDir "filing_snapshot.md"

$inventoryRows | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $sourceInventoryPath

$manifestLines = foreach ($row in $inventoryRows) {
  "$($row.Sha256)  $($row.RelativePath -replace "\\", "/")"
}
$manifestLines | Set-Content -Encoding UTF8 -Path $hashManifestPath

$dependencyRows = New-Object System.Collections.Generic.List[object]
$packageJsonFiles = Get-ChildItem -Path @("apps", "services") -Filter "package.json" -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { -not (Test-ExcludedPath -RelativePath (Get-RelativePath -BasePath $repoRoot -TargetPath $_.FullName)) }

foreach ($packageJson in $packageJsonFiles) {
  Add-DependencyRowsFromPackageJson -ManifestPath $packageJson.FullName -Rows $dependencyRows -RepoRoot $repoRoot
}

$requirementsFiles = Get-ChildItem -Path @("services", "infra") -Filter "requirements.txt" -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { -not (Test-ExcludedPath -RelativePath (Get-RelativePath -BasePath $repoRoot -TargetPath $_.FullName)) }

foreach ($requirements in $requirementsFiles) {
  Add-DependencyRowsFromRequirements -RequirementsPath $requirements.FullName -Rows $dependencyRows -RepoRoot $repoRoot
}

$dependencyRows | Sort-Object Ecosystem, Manifest, DependencyType, Name |
  Export-Csv -NoTypeInformation -Encoding UTF8 -Path $dependencyInventoryPath

$licenseLines = New-Object System.Collections.Generic.List[string]
$licenseLines.Add("# Open Source License Evidence")
$licenseLines.Add("")
$licenseLines.Add("Generated: $(Get-Date -Format o)")
$licenseLines.Add("")
$licenseLines.Add("This file is an initial evidence worksheet. The team must verify each license from official package sources before filing or depositing.")
$licenseLines.Add("")
$licenseLines.Add("| Ecosystem | Manifest | Type | Name | Version | License | Source URL | Evidence |")
$licenseLines.Add("| --- | --- | --- | --- | --- | --- | --- | --- |")
foreach ($row in ($dependencyRows | Sort-Object Ecosystem, Manifest, DependencyType, Name)) {
  $licenseLines.Add("| $($row.Ecosystem) | $($row.Manifest) | $($row.DependencyType) | $($row.Name) | $($row.DeclaredVersion) | $($row.License) | $($row.SourceUrl) | $($row.Evidence) |")
}
$licenseLines | Set-Content -Encoding UTF8 -Path $licenseEvidencePath

$gitHead = "NOT_AVAILABLE"
$gitStatus = "NOT_AVAILABLE"
try {
  $gitHeadOutput = git rev-parse --verify HEAD 2>$null
  if ($LASTEXITCODE -eq 0 -and $gitHeadOutput) {
    $gitHead = $gitHeadOutput
  } else {
    $gitHead = "NO_COMMIT"
  }
} catch {
  $gitHead = "NO_COMMIT"
}

try {
  $gitStatusOutput = git status --short 2>$null
  if ($LASTEXITCODE -eq 0) {
    $gitStatus = $gitStatusOutput -join "`n"
    if (-not $gitStatus) {
      $gitStatus = "clean"
    }
  }
} catch {
  $gitStatus = "git status failed: $($_.Exception.Message)"
}

$snapshot = @"
# Filing Snapshot

Generated: $(Get-Date -Format o)
Repository: $repoRoot
Git HEAD: $gitHead

## Included Inputs

$($IncludePaths | ForEach-Object { "- $_" } | Out-String)

## Generated Files

- source_package_inventory.csv
- hash_manifest.sha256
- dependency_inventory.csv
- open_source_license_evidence.md

## Exclusions

- .git, .sisyphus
- node_modules, dist, build, venv, cache/build folders
- .env and environment-specific secret files
- private key/certificate/database/log file patterns

## Git Status At Generation

~~~text
$gitStatus
~~~

## Before External Filing

- Confirm official forms, fees, authentication and submission requirements on the filing date.
- Remove secrets and personal data from any submitted package.
- Verify licenses manually; generated dependency rows are not legal clearance.
- Recompute package archive SHA-256 after the final archive is created.
"@

$snapshot | Set-Content -Encoding UTF8 -Path $snapshotPath

Write-Host "IP evidence package generated:"
Write-Host "  $sourceInventoryPath"
Write-Host "  $hashManifestPath"
Write-Host "  $dependencyInventoryPath"
Write-Host "  $licenseEvidencePath"
Write-Host "  $snapshotPath"
