# Shell Canvas Integration

This note summarizes how the desktop shell talks to the canvas and export hooks.

## Main Visible Surfaces

- top status: `#juggernaut-selection-status`
- export toggle: `#juggernaut-export-psd`
- export menu: `#juggernaut-export-menu`
- left rail root: `#action-grid`
- empty-canvas upload surface: `#drop-hint`

## Global Bridge

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

## Current Tool Keys

- `upload`
- `select`
- `cut_out`
- `remove`
- `reframe`
- `variants`
- `remove_people`

## Export Note

`requestExport(meta?)` supports `psd`, `png`, `jpg`, `jpeg`, `webp`, `tiff`, and `tif`. All built-in formats go through the shared native export command so receipts stay consistent.
