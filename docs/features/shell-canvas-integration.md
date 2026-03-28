# Shell Canvas Integration Notes

Scope owned by `feature/shell-canvas`:
- app shell launch state
- upload-to-canvas entry points
- visible left rail scaffold
- shell-side tool/export bridge hooks

Not owned here:
- custom tool generation internals
- photo edit execution internals
- PSD export internals

## Visible shell surfaces

- Top shell status: `#juggernaut-selection-status`
- Export menu toggle: `#juggernaut-export-psd`
- Export format menu: `#juggernaut-export-menu`
- Left rail root: `#action-grid`
- Empty-canvas upload surface: `#drop-hint`

The main visible tool rail is icon-only. Upload and lasso/select remain shell-owned. Tool/edit/export actions are expected to connect through the bridge below.

## Global bridge

Frontend integration entrypoint:

```js
window.__JUGGERNAUT_SHELL__
```

Available methods:

- `registerToolInvoker(fn)`
- `registerPsdExportHandler(fn)`
- `requestExport(meta?)`
- `requestToolInvocation(toolKey, meta?)`
- `requestPsdExport(meta?)`
- `importImages()`
- `getCanvasSnapshot()`

Each `register...` call stores the handler and returns an unregister function.

## Tool invoker payload

`registerToolInvoker(fn)` receives:

```js
{
  toolKey,
  label,
  source,
  context,
  requestedAt
}
```

Current shell rail tool keys:

- `upload`
- `select`
- `cut_out`
- `remove`
- `reframe`
- `variants`
- `remove_people`

Runtime-only image actions remain invokable for non-rail callers, but they are not currently exposed in the visible left rail:

- `new_background`
- `polish`
- `relight`

`context` comes from `getCanvasSnapshot()` and includes:

```js
{
  version,
  runDir,
  canvasMode,
  imageCount,
  activeImageId,
  activeImagePath,
  selectedImageIds,
  images: [{ id, path, label, width, height, active, selected }]
}
```

## Export payload

`registerPsdExportHandler(fn)` receives:

```js
{
  source,
  format: "psd",
  context,
  requestedAt
}
```

`requestExport(meta?)` accepts `format: "psd" | "png" | "jpg" | "jpeg" | "webp" | "tiff" | "tif"` and routes all built-in formats through the shared native export command so they all write receipts beside the chosen destination. `registerPsdExportHandler(fn)` remains PSD-only for compatibility with the existing shell bridge surface.

## Events

The shell emits browser events for observers/integration glue:

- `juggernaut:shell-ready`
- `juggernaut:tool-requested`
- `juggernaut:export-requested`
- `juggernaut:export-psd-requested`
- `juggernaut:apply-tool`
- `juggernaut:export`
- `juggernaut:export-psd`

`juggernaut:apply-tool` and `juggernaut:export-psd` are cancelable and remain available for compatibility with the in-progress shell code already present in `canvas_app.js`.
