---
description: Get an independent review of the current diff from a different AI provider
argument-hint: "[--provider openai|anthropic] [--base REF]"
---
Run the cross-model review: `bash scripts/cross-review.sh $ARGUMENTS` (WSL/bash only).

Then, for each finding, give a one-line assessment: AGREE or DISAGREE, with the reason, and the
fix you would make if the human accepts it. Do not change any code. The human decides which
findings to act on.
