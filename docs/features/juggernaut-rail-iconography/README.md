# Cue Rail Iconography

This branch owns the generated iconography shared by the left rail and the session/titlebar shell actions.

## Source Of Truth

- Blueprint: `desktop/src/juggernaut_shell/rail_icon_blueprint.js`
- Pack metadata: `desktop/src/juggernaut_shell/rail_icon_packs.js`
- Generator: `scripts/generate_juggernaut_rail_icons.mjs`
- Generated registry: `desktop/src/juggernaut_shell/generated/rail_icon_registry.js`
- Generated assets: `desktop/src/assets/juggernaut-rail-icons/`

## Regeneration

Run:

```bash
cd desktop
npm run generate:rail-icons
```

To regenerate only newly added or revised ids without rebuilding the full pack set:

```bash
cd desktop
node ../scripts/generate_juggernaut_rail_icons.mjs --only new_session,fork_session,history,agent_run,design_review,export
```

The generator emits:

- per-tool PNG mask assets generated through Oscillo's Gemini image path
- `manifest.json` with tool-to-asset mapping, per-pack prompt direction, effective prompts, and mask-processing metadata
- a JS registry consumed by the live rail and session/titlebar controls, keyed by icon pack

## Packs

- `oscillo_ink`
  - `Oscillo / Cuphead`
  - current Oscillo-style golden-age animation pack
- `industrial_mono`
  - `Jony Ive`
  - reductive product-icon geometry
- `painterly_folk`
  - `Frida Kahlo`
  - symbolic painterly folk-art interpretation
- `kinetic_marker`
  - `Michael Jordan`
  - athletic marker-motion interpretation

The live app keeps the pack switch local at runtime, but the icon assets themselves are now provider-generated. The rail and the session/titlebar shell tint the generated PNGs through CSS mask rendering so the app can still drive the final color from `currentColor`.

## Integration Notes

- Layout branch: keep the rendered icon size around `28px` inside the existing `54px` hit target. The generated assets are normalized onto a `256x256` square canvas before the rail consumes them.
- Visual branch: recolor via button `color`; every generated asset is rendered as a CSS mask so the shell still owns the tint.
- Future tool additions: add a blueprint entry, rerun the generator, then wire the new `toolId` into `desktop/src/juggernaut_shell/rail.js`, the titlebar/session shell, or any runtime-owned action list that should consume the pack.
- Settings integration: the first global iconography toggle lives in the Settings drawer and the native `Settings` menu after `Window`.
- Prompting branch: keep the prompt simple, clear, high-contrast, and large-in-frame so the mask extractor can remove the background reliably.
