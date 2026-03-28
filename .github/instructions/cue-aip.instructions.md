---
applyTo: "**"
excludeAgent: "code-review"
---

Follow `AGENTS.md` for repo conventions, commands, and style.

## Intake / Discovery (Preferred)
- Read `llms.txt` first.
- If outbound HTTPS is allowed, call the Agent Intake Protocol (AIP) endpoint described in `agent-intake.json` to get curated entrypoints and optional context pack URLs.
- Use coarse `task.tags[]` from `agent-intake.json` (avoid raw prompts). Never send secrets.
- If AIP is unavailable, use `agent-intake.json` -> `fallback_entrypoints`.

## Current Runtime Focus
- Prefer the current agent/runtime files over older broad conceptual docs:
  - `desktop/src/agent_runner_runtime.js`
  - `desktop/src/agent_runner_goal_contract.js`
  - `desktop/src/agent_observable_driver.js`
  - `desktop/src/single_image_capability_routing.js`
  - `desktop/src/tool_runtime.js`
- Use `docs/agent-runtime.md` and `docs/agent-affordances.json` as the current public contract summary.

## Generated Artifacts
- Do not commit generated packs/logs under `outputs/aip_packs/` or `outputs/aip_server/`.
