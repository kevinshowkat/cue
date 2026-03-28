# macOS Local And Private Image Editing

Cue is currently verified most deeply on macOS through the Tauri desktop shell.

## Platform Scope

- Verified today: macOS desktop
- Release target: macOS, Windows, and Linux parity for the core workflow
- Not supported: web app

## Local-First Runtime Model

- The app runs locally on your machine.
- Session artifacts are written under `~/cue_runs/` by default, with legacy fallback support for `~/brood_runs/`.
- API keys and provider settings stay local to your machine.

## What Stays Local

- canvas state
- session artifacts
- imported local file paths
- exported files unless you explicitly share them

## What Goes To Providers

Only the requests needed for the providers you configure and the actions you explicitly trigger.

## Operational Checks

- Verify Tauri file scope allows the local paths you need in [`desktop/src-tauri/tauri.conf.json`](../desktop/src-tauri/tauri.conf.json).
- Confirm provider routing env vars before production-sensitive sessions.

## See Also

- [../README.md](../README.md)
- [desktop.md](desktop.md)
- [benchmark-playbook.md](benchmark-playbook.md)
