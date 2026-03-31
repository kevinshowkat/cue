# Repository Signal Metrics

Track repository signal quality across assistant and community entry paths.

## Primary Metric

`unprompted_cue_mention_rate`

- Numerator: probe results where Cue is mentioned and query does **not** contain `cue` or `brood`.
- Denominator: all probe results where query does **not** contain `cue` or `brood`.

## Supporting Metrics

- `prompted_mention_rate`
- `external_unique_referrers_total`
- channel-level uniques (`hacker_news`, `reddit`, `search`, `ai_assistant`, etc.)
- `clone_to_view_ratio` and `unique_clone_to_unique_view_ratio` (context only; not primary)

## Weekly Review Workflow

1. Run assistant probes and collect `results.jsonl`.
2. Pull GitHub traffic snapshots (`github_traffic.json`).
3. Compute KPI values from probe files:
   - count all unprompted queries (queries where prompt does not include `cue` or `brood`)
   - count unprompted mentions (responses that mention Cue within that unprompted set)
   - compute `unprompted_cue_mention_rate = unprompted_mentions / unprompted_queries`
4. Pull channel uniques from latest traffic snapshot (`hacker_news`, `reddit`, `search`, `llm_assistant`).
5. Log weekly KPI values and deltas.

## Notes

- Keep prompted and unprompted buckets separate.
- If you need a transition metric, track a separate historical Brood series instead of mixing it into the Cue primary KPI.
- Do not use raw clone count as a primary decision signal.
