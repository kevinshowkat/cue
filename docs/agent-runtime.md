# Automation Overview

Cue exposes enough runtime surface for tooling and automation to inspect state, trigger app actions, and export results.

## Main Surfaces

- observe current tab and canvas state
- run direct actions
- use communication tools to mark intent
- request `Design Review`
- apply a selected proposal
- create a reusable tool
- export the current result

## Practical Rule Of Thumb

- inspect state before changing it
- use direct actions for clear single-step changes
- use `Design Review` for ambiguous or multi-step edits
- keep reversible boundaries before expensive work

## Notes

- the public product name is Cue even if some internals still use older names
- the app is verified most deeply on macOS in the current public release
