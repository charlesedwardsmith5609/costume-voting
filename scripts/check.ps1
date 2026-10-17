# Validation gate: gofmt, go vet, go test with the race detector.
# Usage: pwsh -NoProfile -File scripts/check.ps1
$ErrorActionPreference = 'Continue'
Set-Location (Join-Path $PSScriptRoot '..')

$fail = $false
$pkgs = (& go list ./... 2>$null | Out-String).Trim()
if (-not $pkgs) {
    Write-Host "No Go packages yet. Toolchain OK: $(& go version)"
    Write-Host 'CHECK PASSED (nothing to check)' -ForegroundColor Green
    exit 0
}
function Stage($name) { Write-Host "`n== $name" -ForegroundColor Cyan }

Stage 'gofmt'
$unformatted = (& gofmt -l . 2>&1 | Out-String).Trim()
if ($unformatted) {
    Write-Host 'FAIL: files need gofmt:' -ForegroundColor Red
    Write-Host $unformatted
    Write-Host 'Fix: gofmt -w .  (on Windows this is often CRLF line endings)' -ForegroundColor Yellow
    $fail = $true
} else { Write-Host 'PASS' -ForegroundColor Green }

Stage 'go vet'
& go vet ./...
if ($LASTEXITCODE -eq 0) { Write-Host 'PASS' -ForegroundColor Green } else { Write-Host 'FAIL' -ForegroundColor Red; $fail = $true }

Stage 'go test'
$raceArgs = @('-race')
$cgo = (& go env CGO_ENABLED).Trim()
$cc = (& go env CC).Trim()
if ($cgo -ne '1' -or -not (Get-Command $cc -ErrorAction SilentlyContinue)) {
    Write-Host 'WARNING: race detector unavailable (needs CGO_ENABLED=1 and a C compiler such as gcc from MSYS2/MinGW-w64).' -ForegroundColor Yellow
    Write-Host 'WARNING: running tests WITHOUT -race.' -ForegroundColor Yellow
    $raceArgs = @()
}
& go test @raceArgs -count=1 -timeout 60s ./...
if ($LASTEXITCODE -eq 0) { Write-Host 'PASS' -ForegroundColor Green } else { Write-Host 'FAIL' -ForegroundColor Red; $fail = $true }

Write-Host ''
if ($fail) {
    Write-Host 'CHECK FAILED' -ForegroundColor Red
    exit 1
}
$suffix = if ($raceArgs.Count -gt 0) { ' (with -race)' } else { '' }
Write-Host "CHECK PASSED$suffix" -ForegroundColor Green
exit 0
