# Juggernaut Rail Iconography

This branch owns the left-rail glyph language only.

## Source Of Truth

- Blueprint: `desktop/src/juggernaut_shell/rail_icon_blueprint.js`
- Generator: `scripts/generate_juggernaut_rail_icons.mjs`
- Generated registry: `desktop/src/juggernaut_shell/generated/rail_icon_registry.js`
- Generated assets: `desktop/src/assets/juggernaut-rail-icons/`

## Regeneration

Run:

```bash
cd desktop
npm run generate:rail-icons
```

The generator emits:

- per-tool SVG assets for inspection or handoff
- `manifest.json` with tool-to-asset mapping
- a JS registry consumed by the live rail

## Integration Notes

- Layout branch: keep the rendered icon size around `28px` inside the existing `54px` hit target. The glyphs are drawn on a `24x24` grid with a `2.4px` safe area, so scaling larger is fine, but avoid cropping with tighter button padding.
- Visual branch: recolor via button `color`; every glyph is `currentColor`-driven with only low-opacity internal fills. You should not need to edit SVG paths to retint the rail.
- Future tool additions: add a blueprint entry, rerun the generator, then wire the new `toolId` into `desktop/src/juggernaut_shell/rail.js` or the runtime-owned rail item list.
- The first-pass language intentionally stays machined and text-free rather than photoreal or stock-pack generic. If a later pass adds model-generated variants, keep a deterministic manifest and retain these local SVG fallbacks.
