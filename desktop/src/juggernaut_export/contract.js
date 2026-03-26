export const JUGGERNAUT_PSD_EXPORT_CONTRACT = "juggernaut.psd_export.v1";

export const JUGGERNAUT_PSD_EXPORT_LIMITATIONS = [
  "PSD export is flattened to a single bitmap composition with alpha; editable per-source PSD layers are not included in this March 8 slice.",
  "Export reconstructs canvas placement from Cue run artifacts and does not preserve live tool semantics, masks, or effect-token re-editability.",
  "If the shell still requests export.html, the native exporter normalizes the output artifact to .psd and leaves a pointer note at the requested legacy path.",
];

export function defaultJuggernautPsdExportInput() {
  return {
    documentName: "",
    images: [],
    activeImageId: null,
    editReceipts: [],
  };
}

export function defaultJuggernautPsdExportOutput() {
  return {
    ok: false,
    psdPath: null,
    receiptPath: null,
    limitations: [...JUGGERNAUT_PSD_EXPORT_LIMITATIONS],
  };
}

// Shell contract note:
// `exportJuggernautPsd()` remains the canonical shell entrypoint. The native
// `export_run` Tauri command is the implementation surface behind that hook.
