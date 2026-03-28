# Benchmark Playbook

Use this playbook to publish reproducible benchmark artifacts that contributors and maintainers can cite.

## Goal

Capture evidence for a stable end-to-end workflow:

- image inputs
- context capture
- proposal generation
- artifact output
- final acceptance or rejection

## Minimum Row Data

- run id
- scenario name
- inputs
- key actions covered
- model or route profile
- median latency
- outcome notes

## Required Artifacts

- `events.jsonl`
- key payloads when relevant
- output artifact files
- a short run summary

## Consistency Checks

- event coverage is explicit, not inferred
- references are reconstructable from logs
- proposal lifecycle is complete when review is part of the flow
