# macOS Local And Private Image Editing

Cue is verified most deeply on macOS in the current public release.

## What Runs Locally

- the desktop app
- session files
- imported local file paths
- exported results unless you choose to share them

## Where Files Go

- runs are stored under `~/cue_runs/` by default
- older setups may still use `~/brood_runs/`
- API keys and provider settings stay on your machine

## What May Leave Your Machine

Only the provider requests needed for the services you configure and the actions you choose to run.

## Related Files

- [`../README.md`](../README.md)
- [`desktop.md`](desktop.md)
- [`../desktop/src-tauri/tauri.conf.json`](../desktop/src-tauri/tauri.conf.json)
