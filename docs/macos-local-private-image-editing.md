# macOS Local and Private Image Editing

Cue is currently verified most deeply on macOS through the Tauri desktop shell. Release still targets the same core feature set across macOS, Windows, and Linux, but Mac is the strongest local/private path today.

## Platform Scope

- Verified today: macOS desktop (Tauri)
- Release target: macOS, Windows, and Linux parity for the core workflow
- Not supported: web app

## Local-First Runtime Model

- The app runs locally on your machine.
- Session artifacts are written under `~/brood_runs/`.
- API keys and provider settings stay local to your machine based on your environment and onboarding setup.

## What Stays Local

- Canvas state and session artifacts (`events.jsonl`, snapshots, receipts, timeline state)
- Imported local file paths and generated output files in run directories
- Exported PSD/PNG files unless you explicitly move or share them

## What Goes To Providers

Only requests needed for selected model providers (OpenAI, Gemini, Imagen, Flux, etc.), based on your configured keys, explicit actions, and runtime settings. Design review/apply and any enabled upload-analysis path are the main model-backed routes in the current slice.

## Privacy-Oriented Workflow Tips

- Use a dedicated local run directory per project and archive completed runs.
- Rotate API keys and avoid sharing raw run folders outside your team.
- Keep telemetry opt-in and coarse-grained where possible.

## Operational Checks

- Verify Tauri file scope allows required local paths (`$HOME/**`, `$DESKTOP/**`) in [`desktop/src-tauri/tauri.conf.json`](/Users/mainframe/Desktop/projects/Juggernaut/desktop/src-tauri/tauri.conf.json).
- Confirm provider routing env vars before running production-sensitive sessions.

## See Also

- [README.md](/Users/mainframe/Desktop/projects/Juggernaut/README.md)
- [docs/desktop.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/desktop.md)
- [docs/benchmark-playbook.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/benchmark-playbook.md)
