# FitConnect MVP local runner
# Preferred path: Docker Compose through deploy-local.ps1

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

Write-Host "Starting FitConnect MVP with Docker Compose..." -ForegroundColor Green

$Args = @()
if ($NoBuild) { $Args += "-NoBuild" }
if ($WithModels) { $Args += "-WithModels" }
if ($WithAdmin) { $Args += "-WithAdmin" }
if ($Foreground) { $Args += "-Foreground" }

& "$Root\deploy-local.ps1" @Args

Write-Host ""
Write-Host "Gateway / web admin: http://localhost:8088" -ForegroundColor White
Write-Host "Web admin direct:    http://localhost:8081" -ForegroundColor White
Write-Host "FastAPI docs:        http://localhost:8088/docs" -ForegroundColor White
Write-Host "FastAPI direct:      http://localhost:8000" -ForegroundColor White
Write-Host "Node BFF direct:     http://localhost:3000" -ForegroundColor White
