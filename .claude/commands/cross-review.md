---
description: Get an independent review of the current diff from a different AI provider
argument-hint: "[--provider openai|anthropic] [--base REF]"
---
Run the cross-model review: `pwsh -NoProfile -File scripts/cross-review.ps1 $ARGUMENTS` on
Windows (use `-Provider` and `-Base` there), otherwise `bash scripts/cross-review.sh $ARGUMENTS`.

Then, for each finding, give a one-line assessment: AGREE or DISAGREE, with the reason, and the
fix you would make if the human accepts it. Do not change any code. The human decides which
findings to act on.
