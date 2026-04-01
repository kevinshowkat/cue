# Effect Token Runtime

This note covers the shared runtime used for extraction effects such as DNA and Soul tokens.

## What It Does

- runs one shared visual pipeline for extraction effects
- turns completed extractions into draggable tokens
- highlights valid drop targets
- dispatches one apply action on a valid drop
- restores cleanly after invalid drops or failed apply attempts

## Main Files

- `desktop/src/effects_runtime.js`
- `desktop/src/effect_specs.js`
- `desktop/src/effect_interactions.js`
- `desktop/src/canvas_app.js`
- `desktop/src/index.html`
- `desktop/src/styles.css`
