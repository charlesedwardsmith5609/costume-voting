# Validation gate: typecheck, tests, production build, client bundle secret scan.
# Usage: pwsh -NoProfile -File scripts/check.ps1
$ErrorActionPreference = 'Continue'
Set-Location (Join-Path $PSScriptRoot '..')

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'FAIL: node not found (need Node 22+)' -ForegroundColor Red
    exit 2
}
if (-not (Test-Path node_modules)) {
    & npm ci --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) { exit 2 }
}

$fail = $false
function Stage($name) { Write-Host "`n== $name" -ForegroundColor Cyan }
function Result($ok) {
    if ($ok) { Write-Host 'PASS' -ForegroundColor Green } else { Write-Host 'FAIL' -ForegroundColor Red; $script:fail = $true }
}

Stage 'typecheck'
& npx --no-install next typegen | Out-Null
$ok = $LASTEXITCODE -eq 0
if ($ok) { & npx --no-install tsc --noEmit; $ok = $LASTEXITCODE -eq 0 }
Result $ok

Stage 'test'
& npx --no-install vitest run
Result ($LASTEXITCODE -eq 0)

Stage 'build'
& npx --no-install next build
Result ($LASTEXITCODE -eq 0)

Stage 'client bundle secrets'
# Server-only secret names must never appear in browser JS; if the service role key value is
# available (env or .env.local), the value must not appear either.
if (-not (Test-Path .next/static)) {
    Write-Host 'FAIL: .next/static missing (build failed?)' -ForegroundColor Red
    $fail = $true
} else {
    $key = $env:SUPABASE_SERVICE_ROLE_KEY
    if (-not $key -and (Test-Path .env.local)) {
        $line = Get-Content .env.local | Where-Object { $_ -match '^SUPABASE_SERVICE_ROLE_KEY=' } | Select-Object -First 1
        if ($line) { $key = ($line -replace '^SUPABASE_SERVICE_ROLE_KEY=', '').Trim().Trim('"', "'") }
    }
    $files = Get-ChildItem -Recurse -File .next/static
    $leaks = @($files | Select-String -Pattern 'SUPABASE_SERVICE_ROLE_KEY|SESSION_SECRET|ADMIN_PASSWORD' -List | ForEach-Object Path)
    if ($key) {
        $leaks += @($files | Select-String -SimpleMatch -Pattern $key -List | ForEach-Object Path)
    } else {
        Write-Host 'note: SUPABASE_SERVICE_ROLE_KEY not set; checked secret names only'
    }
    if ($leaks.Count -gt 0) {
        Write-Host 'FAIL: secret found in client bundle:' -ForegroundColor Red
        $leaks | Sort-Object -Unique | ForEach-Object { Write-Host $_ }
        $fail = $true
    } else { Write-Host 'PASS' -ForegroundColor Green }
}

Write-Host ''
if ($fail) {
    Write-Host 'CHECK FAILED' -ForegroundColor Red
    exit 1
}
Write-Host 'CHECK PASSED' -ForegroundColor Green
exit 0
