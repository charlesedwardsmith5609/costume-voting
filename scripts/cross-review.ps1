# Cross-model review: send the current diff to a different AI provider for an independent review.
# Usage: pwsh -NoProfile -File scripts/cross-review.ps1 [-Provider openai|anthropic] [-Model NAME] [-Base REF]
# Env:   OPENAI_API_KEY / ANTHROPIC_API_KEY, optional REVIEW_PROVIDER, REVIEW_MODEL,
#        OPENAI_BASE_URL, ANTHROPIC_BASE_URL
param(
    [ValidateSet('openai', 'anthropic')]
    [string]$Provider = $(if ($env:REVIEW_PROVIDER) { $env:REVIEW_PROVIDER } else { 'openai' }),
    [string]$Model = $env:REVIEW_MODEL,
    [string]$Base = 'HEAD'
)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

if ($Provider -eq 'openai') {
    if (-not $Model) { $Model = 'gpt-6.1-sol' }
    $key = $env:OPENAI_API_KEY
    $root = if ($env:OPENAI_BASE_URL) { $env:OPENAI_BASE_URL } else { 'https://api.openai.com' }
    $url = "$root/v1/chat/completions"
} else {
    if (-not $Model) { $Model = 'claude-sonnet-5-5' }
    $key = $env:ANTHROPIC_API_KEY
    $root = if ($env:ANTHROPIC_BASE_URL) { $env:ANTHROPIC_BASE_URL } else { 'https://api.anthropic.com' }
    $url = "$root/v1/messages"
}
if (-not $key) { Write-Error "Missing API key for $Provider"; exit 2 }

# Include new, untracked files in the diff without staging their content.
& git add --intent-to-add --all 2>$null | Out-Null
$diff = (& git diff --no-color $Base -- . ':(exclude)go.sum' | Out-String)
if (-not $diff.Trim()) { Write-Host "No changes against $Base. Nothing to review."; exit 0 }
$max = 60000
if ($diff.Length -gt $max) {
    Write-Warning "Diff is $($diff.Length) chars; truncating to $max."
    $diff = $diff.Substring(0, $max)
}

$system = Get-Content -Raw -Encoding UTF8 'skills/review-checklist.md'
$user = "Review this diff:`n`n``````diff`n$diff`n``````"

if ($Provider -eq 'openai') {
    $req = @{ model = $Model; messages = @(@{ role = 'system'; content = $system }, @{ role = 'user'; content = $user }) }
    $headers = @{ Authorization = "Bearer $key" }
} else {
    $req = @{ model = $Model; max_tokens = 2000; system = $system; messages = @(@{ role = 'user'; content = $user }) }
    $headers = @{ 'x-api-key' = $key; 'anthropic-version' = '2023-06-01' }
}
$json = $req | ConvertTo-Json -Depth 6
$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)

Write-Host "Requesting review from $Provider ($Model)..." -ForegroundColor Cyan
try {
    $resp = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $bytes
} catch {
    Write-Error "API call failed: $($_.Exception.Message) $($_.ErrorDetails.Message)"
    exit 1
}

if ($Provider -eq 'openai') {
    $review = $resp.choices[0].message.content
} else {
    $review = ($resp.content | Where-Object { $_.type -eq 'text' } | ForEach-Object { $_.text }) -join ''
}

New-Item -ItemType Directory -Force -Path '.reviews' | Out-Null
$out = ".reviews/review-$(Get-Date -Format 'yyyyMMdd-HHmmss')-$Provider.md"
"# Cross-model review ($Provider, $Model, base $Base)`n`n$review" | Set-Content -Encoding UTF8 $out
Write-Host $review
Write-Host "`nSaved to $out" -ForegroundColor DarkGray
