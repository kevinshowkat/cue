const EXPORT_RUN_ARTIFACTS_DIRNAME = "artifacts";
const EXPORT_RUN_RECEIPTS_DIRNAME = "receipts";

export const CUE_PSD_EXPORT_CONTRACT = "cue.export.psd.v1";
export const CUE_RASTER_EXPORT_CONTRACT = "cue.export.raster.v1";
export const CUE_EXPORT_BASELINE_FORMATS = Object.freeze(["psd", "png"]);
export const CUE_EXPORT_RASTER_FORMATS = Object.freeze(["png", "jpg", "webp", "tiff"]);
export const CUE_NATIVE_EXPORT_FORMATS = Object.freeze([
  ...CUE_EXPORT_BASELINE_FORMATS,
  "jpg",
  "webp",
  "tiff",
]);
export const CUE_EXPORT_ARCHITECTURE_HOOK_FORMATS = Object.freeze(["ai", "fig"]);

export const CUE_PSD_EXPORT_LIMITATIONS = Object.freeze([
  "PSD export is flattened to a single bitmap composition with alpha; editable per-source PSD layers are not included in the current screenshot-polish baseline.",
  "Export reconstructs canvas placement from Cue run artifacts and does not preserve live tool semantics, masks, or effect-token re-editability.",
  "Export pixel dimensions currently follow Cue canvas world geometry in CSS pixels rather than preserving source DPI metadata.",
  "If the shell still requests export.html, the native exporter normalizes the handoff output to .psd and leaves a pointer note at the requested legacy path.",
]);

export const CUE_RASTER_EXPORT_LIMITATIONS = Object.freeze({
  png: Object.freeze([
    "PNG export is flattened to a single bitmap composition with alpha and does not preserve editable layers, masks, or tool semantics.",
    "Canvas transform fidelity is preserved in the flattened composite, but source DPI metadata is not currently retained.",
  ]),
  jpg: Object.freeze([
    "JPG export is flattened to a single bitmap composition; transparent pixels are composited onto white and editable layers are not included in the current screenshot-polish baseline.",
    "Canvas transform fidelity is preserved in the flattened composite, but source DPI metadata is not currently retained.",
  ]),
  webp: Object.freeze([
    "WEBP export is flattened to a single bitmap composition with alpha and does not preserve editable layers, masks, or tool semantics.",
    "Canvas transform fidelity is preserved in the flattened composite, but source DPI metadata is not currently retained.",
  ]),
  tiff: Object.freeze([
    "TIFF export is flattened to a single bitmap composition with alpha and does not preserve editable layers, masks, or tool semantics.",
    "Canvas transform fidelity is preserved in the flattened composite, but source DPI metadata is not currently retained.",
  ]),
});

function normalizeCueExportStem(value = "canvas") {
  const slug = String(value || "canvas")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "canvas";
}

function normalizeCueExportStamp(value = "") {
  const stamp = String(value || "")
    .trim()
    .replace(/[^0-9A-Za-z_-]+/g, "")
    .slice(0, 48);
  return stamp || "latest";
}

function normalizeCueExportRunDir(value = "") {
  return String(value || "").trim().replace(/[\\/]+$/, "");
}

function joinCueExportPath(...segments) {
  const normalized = segments
    .map((segment) => String(segment || "").trim())
    .filter(Boolean)
    .map((segment, index) =>
      index === 0 ? segment.replace(/[\\/]+$/, "") : segment.replace(/^[\\/]+|[\\/]+$/g, "")
    );
  if (!normalized.length) return "";
  return normalized.join("/");
}

export function normalizeCueExportFormat(value = "psd") {
  const normalized = String(value || "psd").trim().toLowerCase();
  if (normalized === "png") return "png";
  if (normalized === "jpg" || normalized === "jpeg") return "jpg";
  if (normalized === "webp") return "webp";
  if (normalized === "tif" || normalized === "tiff") return "tiff";
  return "psd";
}

export function cueExportFileExtension(format = "psd") {
  return `.${normalizeCueExportFormat(format)}`;
}

export function cueExportContractForFormat(format = "psd") {
  return normalizeCueExportFormat(format) === "psd"
    ? CUE_PSD_EXPORT_CONTRACT
    : CUE_RASTER_EXPORT_CONTRACT;
}

export function cueExportWriterIdForFormat(format = "psd") {
  return normalizeCueExportFormat(format) === "psd"
    ? "cue-psd-export-v1"
    : "cue-raster-export-v1";
}

export function cueExportLimitationsForFormat(format = "psd") {
  const normalized = normalizeCueExportFormat(format);
  if (normalized === "psd") return [...CUE_PSD_EXPORT_LIMITATIONS];
  return [...(CUE_RASTER_EXPORT_LIMITATIONS[normalized] || CUE_RASTER_EXPORT_LIMITATIONS.png)];
}

export function buildCueExportArtifactLayout({
  runDir = "",
  format = "psd",
  stem = "canvas",
  stamp = "",
} = {}) {
  const normalizedRunDir = normalizeCueExportRunDir(runDir);
  const normalizedFormat = normalizeCueExportFormat(format);
  const normalizedStem = normalizeCueExportStem(stem);
  const normalizedStamp = normalizeCueExportStamp(stamp);
  const artifactsDir = normalizedRunDir
    ? joinCueExportPath(normalizedRunDir, EXPORT_RUN_ARTIFACTS_DIRNAME)
    : "";
  const receiptsDir = normalizedRunDir
    ? joinCueExportPath(normalizedRunDir, EXPORT_RUN_RECEIPTS_DIRNAME)
    : "";
  const exportStem = `export-${normalizedStem}-${normalizedStamp}`;
  return {
    artifactsDir: artifactsDir || null,
    receiptsDir: receiptsDir || null,
    flattenedSourcePath: artifactsDir
      ? joinCueExportPath(artifactsDir, `${exportStem}.flattened.png`)
      : null,
    artifactPath: artifactsDir
      ? joinCueExportPath(artifactsDir, `${exportStem}${cueExportFileExtension(normalizedFormat)}`)
      : null,
    receiptPath: receiptsDir
      ? joinCueExportPath(receiptsDir, `receipt-${exportStem}.json`)
      : null,
  };
}

export function defaultCueExportInput() {
  return {
    documentName: "",
    images: [],
    activeImageId: null,
    editReceipts: [],
    artifactLayout: buildCueExportArtifactLayout(),
    handoff: {
      outPath: null,
      format: "psd",
    },
  };
}

export function defaultCueExportOutput(format = "psd") {
  const normalizedFormat = normalizeCueExportFormat(format);
  return {
    ok: false,
    format: normalizedFormat,
    outPath: null,
    handoffPath: null,
    artifactPath: null,
    receiptPath: null,
    limitations: cueExportLimitationsForFormat(normalizedFormat),
    architectureHooks: [...CUE_EXPORT_ARCHITECTURE_HOOK_FORMATS],
  };
}

export const JUGGERNAUT_PSD_EXPORT_CONTRACT = CUE_PSD_EXPORT_CONTRACT;
export const JUGGERNAUT_RASTER_EXPORT_CONTRACT = CUE_RASTER_EXPORT_CONTRACT;
export const JUGGERNAUT_NATIVE_EXPORT_FORMATS = CUE_NATIVE_EXPORT_FORMATS;
export const JUGGERNAUT_PSD_EXPORT_LIMITATIONS = [...CUE_PSD_EXPORT_LIMITATIONS];

export function defaultJuggernautPsdExportInput() {
  return defaultCueExportInput();
}

export function defaultJuggernautPsdExportOutput() {
  return {
    ...defaultCueExportOutput("psd"),
    psdPath: null,
  };
}

// Shell contract note:
// `requestExport({ format })` is the general shell entrypoint for receipt-backed
// raster or PSD handoff output, while `exportJuggernautPsd()` remains the
// legacy PSD-specific hook. The native `export_run` Tauri command owns the
// canonical run `artifacts/` and `receipts/` packaging for both paths.
