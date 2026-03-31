# Runbooks

These are the multi-agent execution documents created during the launch/design/polish waves for Cue.

## Current Files

- [WARP_AGENT_LAUNCH.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/WARP_AGENT_LAUNCH.md): reusable multi-agent Warp/worktree setup baseline
- [TODAY_LAUNCH_TASKS.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_LAUNCH_TASKS.md): historical March 8 launch-slice worker prompts
- [WARP_DESIGN_WAVE.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/WARP_DESIGN_WAVE.md): design-wave setup
- [TODAY_DESIGN_WAVE_TASKS.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_DESIGN_WAVE_TASKS.md): design-wave worker prompts
- [WARP_APPLE_POLISH.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/WARP_APPLE_POLISH.md): Apple-polish setup
- [TODAY_APPLE_POLISH_TASKS.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_APPLE_POLISH_TASKS.md): Apple-polish worker prompts
- [WARP_REVIEW_APPLY_WAVE.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/WARP_REVIEW_APPLY_WAVE.md): review-accept apply wave setup
- [TODAY_REVIEW_APPLY_TASKS.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_REVIEW_APPLY_TASKS.md): review-accept apply worker prompts
- [WARP_AGENT_WORKFLOW_WAVE.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/WARP_AGENT_WORKFLOW_WAVE.md): observable-agent workflow wave setup
- [TODAY_AGENT_WORKFLOW_TASKS.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_AGENT_WORKFLOW_TASKS.md): observable-agent workflow worker prompts
- [AGENT_RUNNER_ARAGORN.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/AGENT_RUNNER_ARAGORN.md): local Aragorn goal pack for manual Agent Run testing
- [agent_runner_aragorn_goals.json](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/agent_runner_aragorn_goals.json): machine-readable Aragorn test cases for Agent Run

## Notes

- Most `TODAY_*` files are historical wave instructions. Copy and adapt them rather than following their dates, paths, or branch names literally.
- Historical wave files may retain branch names such as `debrood`; keep those only as historical references, not as current naming guidance.
- `AGENT_RUNNER_ARAGORN.md` and `agent_runner_aragorn_goals.json` are still useful as current manual verification assets for the Agent Run path.
- These are useful for repeatable multi-agent execution, but they are operational history, not product documentation.
- Design Review planner runs now persist `design-review-planner-*.json` traces into the active run directory so request, prompt, provider routing, and raw planner output can be inspected after the fact.
- Keep new runbooks here instead of adding them back to the repository root.
