Analyze the code at $ARGUMENTS for performance issues. Focus on:

1. **Database queries** — N+1 problems, missing indexes, unnecessary joins
2. **Memory** — Large allocations, unbounded arrays, base64 in DB
3. **Network** — Unnecessary API calls, missing caching, waterfall requests
4. **Bundle size** — Unused imports, large dependencies that could be tree-shaken

For each issue found:
- Explain the impact (quantify if possible)
- Show the fix with a code diff
- Rate severity: critical / moderate / minor

Only report real issues — do not suggest premature optimizations.
