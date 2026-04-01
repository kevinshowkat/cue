# Benchmark Playbook

Use this note when you want benchmark results that other contributors can verify and compare against the current verification queue.

## Start From The Queue

- verification queue item: `benchmark.magic_select_runtime`
- milestone: `macos_screenshot_polish_baseline`
- queue listing command:

```bash
node scripts/rewrite_verification_queue.mjs list benchmark.magic_select_runtime
```

- runnable benchmark command shape:

```bash
node scripts/rewrite_verification_queue.mjs run benchmark.magic_select_runtime \
  --image-path /absolute/path/input.png \
  --model-path /absolute/path/mobile_sam.pt
```

- canonical benchmark artifact output path:

```text
outputs/verification/benchmark.magic_select_runtime/benchmark.json
```

## Record

- queue item id
- worktree path and branch
- commit sha
- scenario name
- exact command
- inputs used
- main actions covered
- target budget
- median latency
- p95 latency when available
- output artifact path
- short outcome note

## Attach

- the benchmark JSON payload
- the input image path
- `events.jsonl` when the benchmark touched runtime artifacts
- any important payloads
- output artifacts
- a short summary of what happened

## Rule

Someone else should be able to rerun the same queue item from your note without guessing what changed, which image or weights were used, or where the artifacts were written.
