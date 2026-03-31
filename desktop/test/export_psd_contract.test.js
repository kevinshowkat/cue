import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const app = readFileSync(appPath, "utf8");
const screenshotPolishFixture = JSON.parse(
  readFileSync(join(here, "fixtures", "screenshot_polish", "traceability_fixture.json"), "utf8")
);

function loadNamedFunction(name) {
  const pattern = new RegExp(
    `function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n\\n(?:async\\s+)?function\\s+`,
    "m"
  );
  const match = app.match(pattern);
  assert.ok(match, `${name} function not found`);
  const source = match[0].replace(/\n\n(?:async\s+)?function\s+[\s\S]*$/, "").trim();
  return new Function(`return (${source});`)();
}

test("PSD export helper sanitizes source names into stable file stems", () => {
  const exportBaseStem = loadNamedFunction("exportBaseStem");
  globalThis.basename = (value) => {
    const parts = String(value || "").split(/[\\/]/);
    return parts[parts.length - 1] || "";
  };
  assert.equal(exportBaseStem("Hero Image.png"), "hero-image");
  assert.equal(exportBaseStem("  weird///Name!!.psd  "), "name");
  assert.equal(exportBaseStem(""), "canvas");
  delete globalThis.basename;
});

test("PSD export limitations explicitly call out flattened fidelity", () => {
  const exportPsdLimitations = loadNamedFunction("exportPsdLimitations");
  const limitations = exportPsdLimitations();
  assert.ok(Array.isArray(limitations));
  assert.ok(limitations.some((entry) => /flattened/i.test(String(entry))));
  assert.ok(limitations.some((entry) => /css pixels/i.test(String(entry))));
});

test("Export helpers normalize raster aliases and filter extensions", () => {
  const normalizeExportFormat = loadNamedFunction("normalizeExportFormat");
  globalThis.normalizeExportFormat = normalizeExportFormat;
  try {
    const exportFormatFilterExtensions = loadNamedFunction("exportFormatFilterExtensions");
    assert.equal(normalizeExportFormat("jpeg"), "jpg");
    assert.equal(normalizeExportFormat("tif"), "tiff");
    assert.equal(normalizeExportFormat("webp"), "webp");
    assert.deepEqual(exportFormatFilterExtensions("jpg"), ["jpg", "jpeg"]);
    assert.deepEqual(exportFormatFilterExtensions("tiff"), ["tiff", "tif"]);
  } finally {
    delete globalThis.normalizeExportFormat;
  }
});

test("Export run invokes Tauri with a structured raster request", () => {
  assert.match(app, /async function exportRunInFormat\(format = "psd"\)/);
  assert.match(app, /const normalizedFormat = normalizeExportFormat\(format\);/);
  assert.match(app, /const outPath = await chooseExportDestinationPath\(\{[\s\S]*format: normalizedFormat,[\s\S]*suggestedStem: stem,[\s\S]*stamp,[\s\S]*\}\);/);
  assert.match(app, /const flattenedSourcePath =[\s\S]*join\(state\.runDir,\s*`export-\$\{stem\}-\$\{stamp\}\.flattened\.png`\)/);
  assert.match(app, /const request = buildPsdExportRequest\(\{[\s\S]*outPath,[\s\S]*flattenedSourcePath,[\s\S]*composite,[\s\S]*format: normalizedFormat,[\s\S]*\}\);/);
  assert.match(app, /await invoke\("export_run", \{ request \}\);/);
  assert.match(app, /async function exportRun\(\) \{\s*return exportRunInFormat\("psd"\);\s*\}/);
  assert.match(app, /async function exportRunPng\(\) \{\s*return exportRunInFormat\("png"\);\s*\}/);
  assert.match(app, /async function exportRunJpg\(\) \{\s*return exportRunInFormat\("jpg"\);\s*\}/);
  assert.match(app, /async function exportRunWebp\(\) \{\s*return exportRunInFormat\("webp"\);\s*\}/);
  assert.match(app, /async function exportRunTiff\(\) \{\s*return exportRunInFormat\("tiff"\);\s*\}/);
});

test("Export prompts for a save path so the user can rename the file across raster formats", () => {
  assert.match(app, /const suggestedName = `export-\$\{exportBaseStem\(suggestedStem\)\}-\$\{String\(stamp \|\| exportTimestampTag\(\)\)\}\$\{extension\}`;/);
  assert.match(app, /const extension = exportFormatExtension\(normalizedFormat\);/);
  assert.match(app, /const label = exportFormatLabel\(normalizedFormat\);/);
  assert.match(app, /const picked = await save\(\{[\s\S]*defaultPath,[\s\S]*filters: \[\{ name: label, extensions: exportFormatFilterExtensions\(normalizedFormat\) \}\],[\s\S]*\}\);/);
  assert.match(app, /const normalizedPath = normalizeExportPathExtension\(selectedPath,\s*extension\);/);
});

test("PSD export request carries screenshot-polish approval trace for the approved frame", () => {
  const buildPsdExportRequest = loadNamedFunction("buildPsdExportRequest");
  const normalizeExportFormat = loadNamedFunction("normalizeExportFormat");
  const previousGlobals = {
    collectExportTimelineNodes: globalThis.collectExportTimelineNodes,
    SESSION_TIMELINE_SCHEMA_VERSION: globalThis.SESSION_TIMELINE_SCHEMA_VERSION,
    state: globalThis.state,
    getVisibleActiveId: globalThis.getVisibleActiveId,
    exportPsdLimitations: globalThis.exportPsdLimitations,
    exportRasterFormatLimitations: globalThis.exportRasterFormatLimitations,
    normalizeExportFormat: globalThis.normalizeExportFormat,
  };

  globalThis.collectExportTimelineNodes = () => [];
  globalThis.SESSION_TIMELINE_SCHEMA_VERSION = 1;
  globalThis.state = {
    runDir: "/tmp/run",
    canvasMode: "multi",
    timelineHeadNodeId: "tl-2",
    communication: {
      screenshotPolish: {
        proposalId: "proposal-1",
        selectedProposalId: "proposal-1",
        previewImagePath: "/tmp/preview.png",
        changedRegionBounds: { x: 4, y: 8, w: 64, h: 48 },
        preserveRegionIds: ["subject"],
        rationaleCodes: ["preserve_subject"],
        frameContext: {
          targetImageId: "img-1",
          originalFrame: {
            path: "/tmp/original.png",
          },
          approvedFrame: {
            path: "/tmp/approved.png",
          },
        },
      },
    },
  };
  globalThis.getVisibleActiveId = () => "img-1";
  globalThis.exportPsdLimitations = () => ["flattened"];
  globalThis.exportRasterFormatLimitations = () => ["flattened raster"];
  globalThis.normalizeExportFormat = normalizeExportFormat;

  try {
    const request = buildPsdExportRequest({
      outPath: "/tmp/run/export.psd",
      flattenedSourcePath: "/tmp/run/export.flattened.png",
      composite: {
        width: 100,
        height: 80,
        boundsCss: { x: 0, y: 0, w: 100, h: 80 },
        sourceImages: [],
      },
    });

    assert.equal(request.screenshotPolish?.proposalId, "proposal-1");
    assert.equal(request.screenshotPolish?.selectedProposalId, "proposal-1");
    assert.equal(request.screenshotPolish?.previewImagePath, "/tmp/preview.png");
    assert.deepEqual(request.screenshotPolish?.changedRegionBounds, { x: 4, y: 8, w: 64, h: 48 });
    assert.deepEqual(request.screenshotPolish?.preserveRegionIds, ["subject"]);
    assert.deepEqual(request.screenshotPolish?.rationaleCodes, ["preserve_subject"]);
    assert.equal(request.screenshotPolish?.frameContext?.targetImageId, "img-1");
    assert.equal(request.screenshotPolish?.frameContext?.originalFrame?.path, "/tmp/original.png");
  } finally {
    globalThis.collectExportTimelineNodes = previousGlobals.collectExportTimelineNodes;
    globalThis.SESSION_TIMELINE_SCHEMA_VERSION = previousGlobals.SESSION_TIMELINE_SCHEMA_VERSION;
    globalThis.state = previousGlobals.state;
    globalThis.getVisibleActiveId = previousGlobals.getVisibleActiveId;
    globalThis.exportPsdLimitations = previousGlobals.exportPsdLimitations;
    globalThis.exportRasterFormatLimitations = previousGlobals.exportRasterFormatLimitations;
    globalThis.normalizeExportFormat = previousGlobals.normalizeExportFormat;
  }
});

test("PSD export request omits screenshot-polish trace when another image is active", () => {
  const buildPsdExportRequest = loadNamedFunction("buildPsdExportRequest");
  const normalizeExportFormat = loadNamedFunction("normalizeExportFormat");
  const previousGlobals = {
    collectExportTimelineNodes: globalThis.collectExportTimelineNodes,
    SESSION_TIMELINE_SCHEMA_VERSION: globalThis.SESSION_TIMELINE_SCHEMA_VERSION,
    state: globalThis.state,
    getVisibleActiveId: globalThis.getVisibleActiveId,
    exportPsdLimitations: globalThis.exportPsdLimitations,
    exportRasterFormatLimitations: globalThis.exportRasterFormatLimitations,
    normalizeExportFormat: globalThis.normalizeExportFormat,
  };

  globalThis.collectExportTimelineNodes = () => [];
  globalThis.SESSION_TIMELINE_SCHEMA_VERSION = 1;
  globalThis.state = {
    runDir: "/tmp/run",
    canvasMode: "multi",
    timelineHeadNodeId: "tl-2",
    communication: {
      screenshotPolish: {
        proposalId: "proposal-1",
        selectedProposalId: "proposal-1",
        frameContext: {
          targetImageId: "img-approved",
        },
      },
    },
  };
  globalThis.getVisibleActiveId = () => "img-other";
  globalThis.exportPsdLimitations = () => ["flattened"];
  globalThis.exportRasterFormatLimitations = () => ["flattened raster"];
  globalThis.normalizeExportFormat = normalizeExportFormat;

  try {
    const request = buildPsdExportRequest({
      outPath: "/tmp/run/export.psd",
      flattenedSourcePath: "/tmp/run/export.flattened.png",
      composite: {
        width: 100,
        height: 80,
        boundsCss: { x: 0, y: 0, w: 100, h: 80 },
        sourceImages: [],
      },
    });

    assert.equal(request.screenshotPolish, null);
  } finally {
    globalThis.collectExportTimelineNodes = previousGlobals.collectExportTimelineNodes;
    globalThis.SESSION_TIMELINE_SCHEMA_VERSION = previousGlobals.SESSION_TIMELINE_SCHEMA_VERSION;
    globalThis.state = previousGlobals.state;
    globalThis.getVisibleActiveId = previousGlobals.getVisibleActiveId;
    globalThis.exportPsdLimitations = previousGlobals.exportPsdLimitations;
    globalThis.exportRasterFormatLimitations = previousGlobals.exportRasterFormatLimitations;
    globalThis.normalizeExportFormat = previousGlobals.normalizeExportFormat;
  }
});

test("Export requests carry screenshot-polish lineage across timeline and source receipts", () => {
  const normalizeExportFormat = loadNamedFunction("normalizeExportFormat");
  globalThis.normalizeExportFormat = normalizeExportFormat;
  globalThis.collectExportTimelineNodes = () => screenshotPolishFixture.timelineNodes;
  globalThis.SESSION_TIMELINE_SCHEMA_VERSION = 1;
  globalThis.state = {
    runDir: screenshotPolishFixture.runDir,
    canvasMode: "multi",
    timelineHeadNodeId: screenshotPolishFixture.timelineHeadNodeId,
  };
  globalThis.getVisibleActiveId = () => "img-hero";
  globalThis.exportPsdLimitations = () => ["PSD flattened"];
  globalThis.exportRasterFormatLimitations = (format) => [`${format} flattened`];

  try {
    const buildPsdExportRequest = loadNamedFunction("buildPsdExportRequest");
    const request = buildPsdExportRequest({
      outPath: "/tmp/screenshot-polish.webp",
      flattenedSourcePath: `${screenshotPolishFixture.runDir}/export-approved.flattened.png`,
      format: "webp",
      composite: screenshotPolishFixture.exportComposite,
    });

    assert.equal(request.format, "webp");
    assert.equal(request.runDir, screenshotPolishFixture.runDir);
    assert.equal(request.activeImageId, "img-hero");
    assert.equal(request.timelineSchemaVersion, 1);
    assert.equal(request.timelineHeadNodeId, screenshotPolishFixture.timelineHeadNodeId);
    assert.deepEqual(request.actionSequence, ["Import", "Swap background"]);
    assert.equal(
      request.sourceImages[0].receiptPath,
      "/runs/screenshot-polish/receipt-review-apply.json"
    );
    assert.equal(request.sourceImages[0].timelineNodeId, screenshotPolishFixture.timelineHeadNodeId);
    assert.equal(request.sourceImages[0].sourceReceiptMeta.operation, "design_review_apply");
    assert.equal(
      request.sourceImages[0].sourceReceiptMeta.screenshotPolish.selectedProposalId,
      "proposal-7"
    );
    assert.equal(
      request.sourceImages[0].sourceReceiptMeta.screenshotPolish.approvedProposalId,
      "proposal-7"
    );
    assert.deepEqual(request.limitations, ["webp flattened"]);
  } finally {
    delete globalThis.normalizeExportFormat;
    delete globalThis.collectExportTimelineNodes;
    delete globalThis.SESSION_TIMELINE_SCHEMA_VERSION;
    delete globalThis.state;
    delete globalThis.getVisibleActiveId;
    delete globalThis.exportPsdLimitations;
    delete globalThis.exportRasterFormatLimitations;
  }
});
