#!/usr/bin/env bash
# Cross-model review: send the current diff to a different AI provider for an independent review.
# Usage: bash scripts/cross-review.sh [--provider openai|anthropic] [--model NAME] [--base REF]
# Env:   OPENAI_API_KEY / ANTHROPIC_API_KEY, optional REVIEW_PROVIDER, REVIEW_MODEL,
#        OPENAI_BASE_URL, ANTHROPIC_BASE_URL
set -euo pipefail
cd "$(dirname "$0")/.."

provider="${REVIEW_PROVIDER:-openai}"
model="${REVIEW_MODEL:-}"
base="HEAD"
while [ $# -gt 0 ]; do
  case "$1" in
    --provider) provider="$2"; shift 2 ;;
    --model) model="$2"; shift 2 ;;
    --base) base="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

case "$provider" in
  openai) model="${model:-gpt-6.1-sol}"; key="${OPENAI_API_KEY:-}"; url="${OPENAI_BASE_URL:-https://api.openai.com}/v1/chat/completions" ;;
  anthropic) model="${model:-claude-sonnet-5-5}"; key="${ANTHROPIC_API_KEY:-}"; url="${ANTHROPIC_BASE_URL:-https://api.anthropic.com}/v1/messages" ;;
  *) echo "provider must be openai or anthropic" >&2; exit 2 ;;
esac
[ -n "$key" ] || { echo "missing API key for $provider" >&2; exit 2; }

# Include new, untracked files in the diff without staging their content.
git add --intent-to-add --all >/dev/null 2>&1 || true
diff=$(git diff --no-color "$base" -- . ':(exclude)go.sum')
if [ -z "$diff" ]; then echo "No changes against $base. Nothing to review."; exit 0; fi
max=60000
if [ "${#diff}" -gt "$max" ]; then
  echo "WARNING: diff is ${#diff} chars; truncating to $max." >&2
  diff="${diff:0:$max}"
fi

export REVIEW_PROMPT_FILE="skills/review-checklist.md" REVIEW_DIFF="$diff" REVIEW_PROVIDER_RESOLVED="$provider" REVIEW_MODEL_RESOLVED="$model"
body=$(python3 - <<'PY'
import json, os
system = open(os.environ["REVIEW_PROMPT_FILE"], encoding="utf-8").read()
user = "Review this diff:\n\n```diff\n" + os.environ["REVIEW_DIFF"] + "\n```"
model = os.environ["REVIEW_MODEL_RESOLVED"]
if os.environ["REVIEW_PROVIDER_RESOLVED"] == "openai":
    req = {"model": model, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
else:
    req = {"model": model, "max_tokens": 2000, "system": system, "messages": [{"role": "user", "content": user}]}
print(json.dumps(req))
PY
)

echo "Requesting review from $provider ($model)..." >&2
if [ "$provider" = "openai" ]; then
  resp=$(curl -sS "$url" -H "Authorization: Bearer $key" -H "Content-Type: application/json" -d "$body")
else
  resp=$(curl -sS "$url" -H "x-api-key: $key" -H "anthropic-version: 2023-06-01" -H "Content-Type: application/json" -d "$body")
fi

review=$(REVIEW_RESP="$resp" python3 - <<'PY'
import json, os, sys
r = json.loads(os.environ["REVIEW_RESP"])
if "error" in r:
    sys.exit("API error: " + json.dumps(r["error"]))
if "choices" in r:
    print(r["choices"][0]["message"]["content"])
else:
    print("".join(b.get("text", "") for b in r.get("content", [])))
PY
)

mkdir -p .reviews
out=".reviews/review-$(date +%Y%m%d-%H%M%S)-$provider.md"
printf '# Cross-model review (%s, %s, base %s)\n\n%s\n' "$provider" "$model" "$base" "$review" > "$out"
printf '%s\n\nSaved to %s\n' "$review" "$out"
