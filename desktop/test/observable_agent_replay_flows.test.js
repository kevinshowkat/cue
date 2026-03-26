import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createAgentObservableDriver } from "../src/agent_observable_driver.js";
import {
  AGENT_OBSERVABLE_TRACE_FILENAME,
  AGENT_OBSERVABLE_TRACE_SCHEMA,
  createAgentTraceLog,
} from "../src/agent_trace_log.js";
import { buildDesignReviewRequest } from "../src/design_review_contract.js";
import { createDesignReviewPipeline } from "../src/design_review_pipeline.js";
import { applyToolRuntimeRequest } from "../src/tool_apply_runtime.js";
import { buildSingleImageDirectAffordanceInvocation } from "../src/tool_runtime.js";
import { JUGGERNAUT_PSD_EXPORT_CONTRACT } from "../src/juggernaut_export/contract.js";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const fixturesPath = join(here, "fixtures", "observable_agent_replay", "flow_fixtures.json");
const app = readFileSync(appPath, "utf8");
const replayFixtures = JSON.parse(readFileSync(fixturesPath, "utf8"));

function extractFunctionSource(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => app.indexOf(marker))
    .find((index) => index >= 0);
  assert.notEqual(start, undefined, `Could not find function ${name}`);
  const signatureStart = app.indexOf("(", start);
  assert.notEqual(signatureStart, -1, `Could not find signature for ${name}`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = signatureStart; index < app.length; index += 1) {
    const char = app[index];
    if (char === "(") parenDepth += 1;
    if (char === ")") parenDepth -= 1;
    if (parenDepth === 0 && char === "{") {
      bodyStart = index;
      break;
    }
  }
  assert.notEqual(bodyStart, -1, `Could not find body for ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    const char = app[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return app.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract function ${name}`);
}

function instantiateCanvasAppFunction(name, deps = {}) {
  const source = extractFunctionSource(name);
  const keys = Object.keys(deps);
  const values = Object.values(deps);
  return new Function(...keys, `return (${source});`)(...values);
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function readFirstString(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function readFirstNumber(...values) {
  for (const value of values) {
    const numeric = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return Number.NaN;
}

function uniqueStringList(values = []) {
  const out = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function writeTextFile(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function writeJson(path, payload) {
  writeTextFile(path, JSON.stringify(payload, null, 2));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function placeholderBytes(label) {
  return Buffer.from(`fixture:${label}\n`, "utf8");
}

function writeArtifactFile(path, label) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, placeholderBytes(label));
}

function boundsFromPoints(points = []) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of Array.isArray(points) ? points : []) {
    const x = Number(point?.x);
    const y = Number(point?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function createCanvasStub() {
  return {
    width: 0,
    height: 0,
    getContext() {
      return {
        drawImage() {},
        getImageData() {
          return {
            width: 2,
            height: 2,
            data: new Uint8ClampedArray([
              92, 104, 116, 255,
              86, 100, 122, 255,
              80, 94, 118, 255,
              74, 88, 114, 255,
            ]),
          };
        },
        putImageData() {},
      };
    },
  };
}

function createHarness(flow) {
  const runDir = mkdtempSync(join(tmpdir(), `juggernaut-agent-replay-${flow.id}-`));
  const state = {
    runDir,
    canvasMode: "single",
  };
  const visibleCanvasRef = join(runDir, "visible-canvas.png");
  writeArtifactFile(visibleCanvasRef, "visible-canvas");

  let clockMs = Date.parse("2026-03-10T09:30:00.000Z");
  let artifactSeq = 0;
  let timelineSeq = 0;
  let markSeq = 0;
  let regionSeq = 0;
  let failed = false;
  const marks = [];
  const regionCandidates = [];
  const timelineNodes = [];
  const imagesById = new Map();
  const activeImageId = readFirstString(flow.initialImage?.id, "img-hero");
  const initialImagePath = join(runDir, "input.png");
  const initialReceiptPath = join(runDir, "receipt-initial.json");
  const initialLabel = readFirstString(flow.initialImage?.label, "Hero");

  writeArtifactFile(initialImagePath, "initial-image");
  writeJson(initialReceiptPath, {
    schema_version: 1,
    request: {
      prompt: "",
      mode: "import",
      output_format: "png",
      metadata: {
        operation: "import",
      },
    },
    resolved: {
      provider: "local",
      model: null,
      output_format: "png",
      warnings: [],
    },
    provider_request: {},
    provider_response: {},
    warnings: [],
    artifacts: {
      image_path: initialImagePath,
      receipt_path: initialReceiptPath,
    },
    result_metadata: {
      operation: "import",
      created_at: new Date(clockMs).toISOString(),
    },
  });

  imagesById.set(activeImageId, {
    id: activeImageId,
    path: initialImagePath,
    receiptPath: initialReceiptPath,
    label: initialLabel,
    kind: "upload",
    timelineNodeId: "tl-initial",
    width: 2,
    height: 2,
    img: {
      naturalWidth: 2,
      naturalHeight: 2,
    },
  });
  timelineNodes.push({
    nodeId: "tl-initial",
    imageId: activeImageId,
    path: initialImagePath,
    receiptPath: initialReceiptPath,
    label: initialLabel,
    action: null,
    parents: [],
    createdAt: clockMs,
  });

  const exportPsdLimitations = instantiateCanvasAppFunction("exportPsdLimitations");
  const resolveDesignReviewApplyRequestImagePath = instantiateCanvasAppFunction(
    "resolveDesignReviewApplyRequestImagePath",
    {
      readFirstString,
    }
  );
  const writeLocalReceipt = instantiateCanvasAppFunction("writeLocalReceipt", {
    state,
    extname,
    writeTextFile: async (path, text) => writeTextFile(path, text),
  });
  const writeDesignReviewApplyReceipt = instantiateCanvasAppFunction("writeDesignReviewApplyReceipt", {
    state,
    extname,
    writeTextFile: async (path, text) => writeTextFile(path, text),
    readFirstString,
    readFirstNumber,
    uniqueStringList,
    asRecord,
    cloneToolRuntimeValue: cloneJson,
    resolveDesignReviewApplyRequestImagePath,
  });
  const buildPsdExportRequest = instantiateCanvasAppFunction("buildPsdExportRequest", {
    collectExportTimelineNodes: () =>
      Array.from(timelineNodes)
        .sort((a, b) => (a?.createdAt || 0) - (b?.createdAt || 0))
        .map((node) => ({
          nodeId: node?.nodeId ? String(node.nodeId) : null,
          imageId: node?.imageId ? String(node.imageId) : null,
          path: node?.path ? String(node.path) : null,
          receiptPath: node?.receiptPath ? String(node.receiptPath) : null,
          label: node?.label ? String(node.label) : null,
          action: node?.action ? String(node.action) : null,
          parents: Array.isArray(node?.parents) ? node.parents.slice() : [],
          createdAt: Number(node?.createdAt) || null,
          createdAtIso: node?.createdAt ? new Date(node.createdAt).toISOString() : null,
        })),
    state,
    getVisibleActiveId: () => activeImageId,
    exportPsdLimitations,
  });

  function nextMs(step = 37) {
    clockMs += step;
    return clockMs;
  }

  function getActiveImage() {
    return imagesById.get(activeImageId) || null;
  }

  function recordTimeline({ action = null, path, receiptPath, kind = null } = {}) {
    const item = getActiveImage();
    const previousNodeId = item?.timelineNodeId ? String(item.timelineNodeId) : null;
    timelineSeq += 1;
    const nodeId = `tl-${timelineSeq}`;
    const createdAt = nextMs();
    const node = {
      nodeId,
      imageId: activeImageId,
      path: String(path || item?.path || ""),
      receiptPath: receiptPath ? String(receiptPath) : null,
      label: item?.label ? String(item.label) : initialLabel,
      action: action ? String(action) : null,
      kind,
      parents: previousNodeId ? [previousNodeId] : [],
      createdAt,
    };
    timelineNodes.push(node);
    if (item) {
      item.timelineNodeId = nodeId;
    }
    return node;
  }

  function replaceActiveImage({ outputPath, receiptPath, kind = null, action = null } = {}) {
    const item = getActiveImage();
    assert.ok(item, "Active image is required");
    item.path = String(outputPath || item.path);
    item.receiptPath = receiptPath ? String(receiptPath) : null;
    if (kind) item.kind = String(kind);
    recordTimeline({
      action,
      path: item.path,
      receiptPath: item.receiptPath,
      kind: item.kind,
    });
    return item;
  }

  function appendJsonl(path, payload) {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(payload)}\n`);
  }

  function tracePath() {
    return join(runDir, AGENT_OBSERVABLE_TRACE_FILENAME);
  }

  function buildShellContext() {
    const item = getActiveImage();
    return {
      runDir,
      activeImageId,
      selectedImageIds: [activeImageId],
      regionSelectionActive: Boolean(regionCandidates.length && activeRegionCandidateId()),
      images: item
        ? [
            {
              id: item.id,
              path: item.path,
            },
          ]
        : [],
    };
  }

  function activeRegionCandidateId() {
    return regionCandidates.find((entry) => entry.isActive)?.id || null;
  }

  function buildVisualPrompt() {
    return {
      canvas: {
        mode: state.canvasMode,
        active_image_id: activeImageId,
      },
      marks: marks.map((mark) => ({ ...mark })),
    };
  }

  function buildReviewRequest(reviewTool = null) {
    return buildDesignReviewRequest({
      shellContext: buildShellContext(),
      visibleCanvasRef,
      visualPrompt: buildVisualPrompt(),
      regionCandidates: regionCandidates.map((candidate) => ({ ...candidate })),
      activeRegionCandidateId: activeRegionCandidateId(),
      reviewTool,
    });
  }

  function writeModelCapabilityReceipt({ invocation, outputPath }) {
    const artifactId = `capability-${String(++artifactSeq).padStart(2, "0")}-${invocation.jobId}`;
    const receiptPath = join(runDir, `receipt-${artifactId}.json`);
    const item = getActiveImage();
    const payload = {
      schema_version: 1,
      request: {
        prompt: "",
        mode: "model_capability",
        size: null,
        n: 1,
        seed: null,
        output_format: extname(outputPath).replace(".", "") || "png",
        inputs: {
          init_image: item?.path || null,
          mask: null,
          reference_images: [],
        },
        provider: "fixture",
        model: "fixture-capability-v1",
        provider_options: {},
        out_dir: runDir,
        metadata: {
          operation: invocation.jobId,
          tool_id: invocation.jobId,
          tool_name: invocation.label,
          capability: invocation.capability,
          execution_kind: invocation.execution.kind,
          route_profile: invocation.route.profile,
          params: cloneJson(invocation.execution.params || {}),
        },
      },
      resolved: {
        provider: "fixture",
        model: "fixture-capability-v1",
        size: null,
        width: 2,
        height: 2,
        output_format: extname(outputPath).replace(".", "") || "png",
        background: null,
        seed: null,
        n: 1,
        user: null,
        prompt: "",
        inputs: {
          init_image: item?.path || null,
          mask: null,
          reference_images: [],
        },
        stream: false,
        partial_images: null,
        provider_params: {
          route_profile: invocation.route.profile,
          execution_kind: invocation.execution.kind,
        },
        warnings: [],
      },
      provider_request: {
        job_id: invocation.jobId,
        capability: invocation.capability,
        params: cloneJson(invocation.execution.params || {}),
      },
      provider_response: {
        output_path: outputPath,
      },
      warnings: [],
      artifacts: {
        image_path: outputPath,
        receipt_path: receiptPath,
      },
      result_metadata: {
        operation: invocation.jobId,
        tool_id: invocation.jobId,
        capability: invocation.capability,
        created_at: new Date(nextMs()).toISOString(),
      },
    };
    writeJson(receiptPath, payload);
    return receiptPath;
  }

  function buildExportComposite() {
    const item = getActiveImage();
    assert.ok(item, "Active image missing for export");
    return {
      width: 2,
      height: 2,
      boundsCss: {
        x: 0,
        y: 0,
        w: 2,
        h: 2,
      },
      sourceImages: [
        {
          id: item.id,
          path: item.path,
          receiptPath: item.receiptPath,
          label: item.label,
          kind: item.kind,
          timelineNodeId: item.timelineNodeId,
          width: 2,
          height: 2,
          zIndex: 0,
          rectCss: {
            x: 0,
            y: 0,
            w: 2,
            h: 2,
          },
          transform: {
            rotateDeg: 0,
            skewXDeg: 0,
          },
          sourceReceiptMeta: null,
        },
      ],
    };
  }

  function writeExportReceipt({ request, psdPath, receiptPath }) {
    const payload = {
      schema_version: 1,
      request: {
        prompt: "",
        mode: "local",
        size: "2x2",
        n: 1,
        seed: null,
        output_format: request.format,
        inputs: {
          init_image: request.flattenedSourcePath,
          mask: null,
          reference_images: request.sourceImages.map((image) => image.path),
        },
        provider: "local",
        model: "juggernaut-psd-export-v1",
        provider_options: {},
        out_dir: request.runDir,
        metadata: {
          operation: "export_psd",
          export_contract: JUGGERNAUT_PSD_EXPORT_CONTRACT,
          active_image_id: request.activeImageId,
          action_sequence: request.actionSequence,
          limitations: request.limitations,
          export_bounds_css: request.exportBoundsCss,
          flattened_size_px: request.flattenedSizePx,
        },
      },
      resolved: {
        provider: "local",
        model: "juggernaut-psd-export-v1",
        size: "2x2",
        width: 2,
        height: 2,
        output_format: request.format,
        background: "transparent",
        seed: null,
        n: 1,
        user: null,
        prompt: "",
        inputs: {
          init_image: request.flattenedSourcePath,
          mask: null,
          reference_images: request.sourceImages.map((image) => image.path),
        },
        stream: false,
        partial_images: null,
        provider_params: {
          layer_strategy: "flattened_single_bitmap",
        },
        warnings: request.limitations,
      },
      provider_request: {
        source_images: cloneJson(request.sourceImages),
        timeline_nodes: cloneJson(request.timelineNodes),
      },
      provider_response: {
        writer: "juggernaut-psd-export-v1",
      },
      warnings: request.limitations,
      artifacts: {
        image_path: request.flattenedSourcePath,
        export_path: psdPath,
        receipt_path: receiptPath,
      },
      result_metadata: {
        operation: "export_psd",
        created_at: new Date(nextMs()).toISOString(),
        format: request.format,
        source_image_count: request.sourceImages.length,
        timeline_node_count: request.timelineNodes.length,
        editable_layer_count: 0,
        fidelity: "partial_flattened",
        canvas_mode: request.canvasMode,
        active_image_id: request.activeImageId,
        limitations: request.limitations,
      },
    };
    writeJson(receiptPath, payload);
  }

  const traceLog = createAgentTraceLog({
    appendJsonl: async (path, payload) => appendJsonl(path, payload),
    resolveRunDir: () => runDir,
    nowMs: () => nextMs(11),
  });

  const driver = createAgentObservableDriver({
    traceLog,
    nowMs: () => nextMs(13),
    performMarkerStroke: async (request = {}) => {
      markSeq += 1;
      const points = Array.isArray(request.points) ? request.points.map((point) => ({ ...point })) : [];
      const bounds = boundsFromPoints(points);
      const mark = {
        id: `mark-${markSeq}`,
        type: "freehand_marker",
        imageId: readFirstString(request.image_id, activeImageId) || activeImageId,
        points,
        bounds,
      };
      marks.push(mark);
      return {
        ok: true,
        mark_id: mark.id,
        image_id: mark.imageId,
        point_count: points.length,
      };
    },
    performMagicSelectClick: async (request = {}) => {
      regionSeq += 1;
      const point = request.point && typeof request.point === "object" ? request.point : request.points?.[0] || { x: 0, y: 0 };
      const candidate = {
        id: `region-${regionSeq}`,
        imageId: readFirstString(request.image_id, activeImageId) || activeImageId,
        bounds: {
          x: Math.max(0, Number(point.x) - 18),
          y: Math.max(0, Number(point.y) - 18),
          width: 44,
          height: 44,
        },
        isActive: true,
      };
      for (const entry of regionCandidates) entry.isActive = false;
      regionCandidates.push(candidate);
      return {
        ok: true,
        active_candidate_id: candidate.id,
        image_id: candidate.imageId,
        candidate_count: regionCandidates.length,
      };
    },
    performEraserStroke: async () => ({
      ok: false,
      operation: "noop",
    }),
    getContextSnapshot: ({ phase }) => ({
      phase,
      markIds: marks.map((mark) => mark.id),
      regionCandidateIds: regionCandidates.map((candidate) => candidate.id),
      activeRegionCandidateId: activeRegionCandidateId(),
      activeImageId,
    }),
  });

  const results = {
    flowId: flow.id,
    runDir,
    reviewRequests: [],
    directResults: [],
    exports: [],
  };

  async function runObservableStep(step) {
    const beforeCount = readJsonl(tracePath()).length;
    const result = await driver.replayTraceEntry(step.entry);
    assert.equal(result.ok, true);
    assert.equal(result.trace.schema, AGENT_OBSERVABLE_TRACE_SCHEMA);
    assert.equal(result.trace.replay.method, step.expectedMethod);
    const afterEntries = readJsonl(tracePath());
    assert.equal(afterEntries.length, beforeCount + 1);
    const persisted = afterEntries.at(-1);
    assert.equal(persisted.schema, AGENT_OBSERVABLE_TRACE_SCHEMA);
    assert.equal(persisted.replay.method, step.expectedMethod);
    if (step.expectedContextAfter?.markCount != null) {
      assert.equal(
        Array.isArray(result.trace.context_after?.markIds) ? result.trace.context_after.markIds.length : 0,
        step.expectedContextAfter.markCount
      );
    }
    if (step.expectedContextAfter?.regionCandidateCount != null) {
      assert.equal(
        Array.isArray(result.trace.context_after?.regionCandidateIds)
          ? result.trace.context_after.regionCandidateIds.length
          : 0,
        step.expectedContextAfter.regionCandidateCount
      );
    }
    return result;
  }

  async function runFocusContractStep(step) {
    const request = buildReviewRequest(step.reviewTool);
    results.reviewRequests.push(request);
    assert.equal(request.reviewTool, step.expected.reviewTool);
    assert.deepEqual(
      request.focusInputs.map((entry) => entry.kind),
      step.expected.focusKinds
    );
    assert.equal(request.protectedRegions.length, step.expected.protectedRegionCount);
    assert.equal(
      Array.isArray(request.reservedSpaceIntent?.areas) ? request.reservedSpaceIntent.areas.length : 0,
      step.expected.reservedSpaceAreaCount
    );
    return request;
  }

  async function runDesignReviewAcceptStep(step) {
    const request = buildReviewRequest(step.reviewTool || null);
    results.reviewRequests.push(request);
    assert.deepEqual(request.markIds, step.expected.markIds);

    const pipeline = createDesignReviewPipeline({
      providerRouter: {
        async runPlanner() {
          return {
            text: JSON.stringify({
              proposals: step.proposals,
            }),
          };
        },
        async runPreview({ proposal, outputPath }) {
          writeArtifactFile(outputPath, `preview:${proposal.proposalId || proposal.label}`);
          return {
            outputPath,
          };
        },
      },
      runApply: async ({ proposal, outputPath }) => {
        writeArtifactFile(outputPath, `design-review:${proposal.proposalId || proposal.label}`);
        return {
          outputPath,
          debugInfo: {
            route: {
              kind: "apply",
              provider: "google",
            },
            providerRequest: {
              model: "gemini-nano-banana-2",
            },
          },
        };
      },
    });

    const review = await pipeline.startReview({
      request,
    });
    assert.equal(review.status, "ready");
    assert.equal(review.proposals.length, 1);
    assert.equal(review.proposals[0].actionType, step.expected.proposalActionType);

    const applyResult = await pipeline.applyProposal(review.proposals[0].proposalId, {
      sessionKey: `tab:${flow.id}`,
    });
    assert.equal(applyResult.ok, true);
    assert.equal(applyResult.targetImageId, activeImageId);
    const targetBefore = cloneJson(getActiveImage());
    const receiptPath = await writeDesignReviewApplyReceipt({
      outputPath: applyResult.outputPath,
      targetBefore,
      targetImageId: applyResult.targetImageId,
      referenceImageIds: applyResult.referenceImageIds,
      proposal: applyResult.proposal,
      request: applyResult.request,
      debugInfo: applyResult.debugInfo,
      provider: "google",
      requestedModel: "gemini-nano-banana-2",
      normalizedModel: "gemini-nano-banana-2",
      costTotalUsd: 0.13,
      latencyPerImageS: 2.8,
    });
    replaceActiveImage({
      outputPath: applyResult.outputPath,
      receiptPath,
      kind: "design_review_apply",
      action: applyResult.proposal.label,
    });

    const receipt = readJson(receiptPath);
    assert.equal(receipt.request.mode, "design_review_apply");
    assert.equal(receipt.request.metadata.action_type, step.expected.proposalActionType);
    assert.equal(receipt.result_metadata.target_image_id, activeImageId);
    assert.equal(receipt.artifacts.image_path, applyResult.outputPath);
    return {
      request,
      review,
      applyResult,
      receiptPath,
    };
  }

  async function runDirectAffordanceStep(step) {
    const invocation = buildSingleImageDirectAffordanceInvocation(step.jobId, {
      activeImageId,
      selectedImageIds: [activeImageId],
      requestId: `${flow.id}-${step.jobId}-${results.directResults.length + 1}`,
      params: cloneJson(step.params || {}),
      mode: state.canvasMode,
      capabilityAvailability: cloneJson(step.capabilityAvailability || null),
      capabilityExecutorAvailable: true,
      localExecutorAvailable: true,
    });

    const host = {
      getActiveImageId: () => activeImageId,
      hasImageId: (imageId) => imagesById.has(String(imageId || "").trim()),
      getImageById: (imageId) => imagesById.get(String(imageId || "").trim()) || null,
      getExecutionMode: () => state.canvasMode,
      ensureRun: async () => {},
      loadTargetImage: async (target) => target?.img || null,
      createCanvas: () => createCanvasStub(),
      saveCanvasArtifact: async (_canvas, options = {}) => {
        artifactSeq += 1;
        const outputPath = join(runDir, `artifact-${String(artifactSeq).padStart(2, "0")}-${step.jobId}.png`);
        writeArtifactFile(outputPath, `${step.jobId}:local`);
        const receiptPath = await writeLocalReceipt({
          artifactId: `local-${String(artifactSeq).padStart(2, "0")}-${step.jobId}`,
          imagePath: outputPath,
          operation: options.operation,
          meta: options.meta,
        });
        replaceActiveImage({
          outputPath,
          receiptPath,
          kind: "local",
          action: options.label || invocation.label,
        });
        return {
          imageId: activeImageId,
          outputPath,
          receiptPath,
        };
      },
      getCapabilityAvailability: (capability) => {
        const table = asRecord(step.capabilityAvailability) || {};
        return table[capability] || { available: false, disabledReason: "capability_unavailable" };
      },
      executeCapability: async () => {
        artifactSeq += 1;
        const outputPath = join(runDir, `artifact-${String(artifactSeq).padStart(2, "0")}-${step.jobId}.png`);
        writeArtifactFile(outputPath, `${step.jobId}:capability`);
        const receiptPath = writeModelCapabilityReceipt({
          invocation,
          outputPath,
        });
        return {
          imageId: activeImageId,
          outputPath,
          receiptPath,
        };
      },
      afterApply: ({ result, artifact }) => {
        if (result?.receiptStep?.kind !== "model_capability_edit") return;
        replaceActiveImage({
          outputPath: artifact.outputPath,
          receiptPath: artifact.receiptPath,
          kind: "engine",
          action: result.receiptStep.toolName || invocation.label,
        });
      },
      normalizeErrorMessage: (error) => String(error?.message || error),
    };

    const result = await applyToolRuntimeRequest(invocation, host);
    results.directResults.push(result);
    assert.equal(invocation.execution.kind, step.expected.executionKind);
    assert.equal(result.ok, true);
    assert.equal(result.toolId, step.expected.toolId);
    assert.equal(result.receiptStep.capability, step.expected.capability);
    assert.equal(result.receiptStep.executionType, step.expected.executionType);
    assert.equal(result.receiptStep.routeProfile, step.expected.routeProfile);

    const receipt = readJson(result.receiptStep.receiptPath);
    assert.equal(receipt.artifacts.image_path, result.outputPath);
    assert.equal(receipt.request.metadata.operation, step.expected.receiptOperation);
    if (step.expected.toolId === "polish") {
      assert.equal(receipt.result_metadata.operation, "polish");
      assert.equal(receipt.result_metadata.tool_id, "polish");
    }
    if (step.expected.toolId === "remove_people") {
      assert.equal(receipt.result_metadata.operation, "remove_people");
      assert.equal(receipt.result_metadata.tool_id, "remove_people");
      assert.equal(receipt.result_metadata.capability, "people_removal");
    }
    if (step.expected.toolId === "relight") {
      assert.equal(receipt.result_metadata.operation, "relight");
      assert.equal(receipt.result_metadata.tool_id, "relight");
      assert.equal(receipt.result_metadata.capability, "image_relight");
    }
    return result;
  }

  async function runExportStep(step) {
    const composite = buildExportComposite();
    const flattenedSourcePath = join(runDir, `${flow.id}.flattened.png`);
    const outPath = join(runDir, `${flow.id}.psd`);
    const receiptPath = join(runDir, `receipt-export-${flow.id}.json`);
    writeArtifactFile(flattenedSourcePath, `${flow.id}:flattened`);
    const request = buildPsdExportRequest({
      outPath,
      flattenedSourcePath,
      composite,
    });
    writeArtifactFile(outPath, `${flow.id}:psd`);
    writeExportReceipt({
      request,
      psdPath: outPath,
      receiptPath,
    });

    assert.equal(request.format, "psd");
    assert.equal(request.runDir, runDir);
    assert.equal(request.activeImageId, activeImageId);
    assert.equal(request.sourceImages.length, step.expected.sourceImageCount);
    assert.equal(request.actionSequence.length, step.expected.actionSequenceLength);
    assert.ok(request.limitations.some((entry) => /flattened/i.test(String(entry))));
    assert.ok(existsSync(outPath));
    assert.ok(existsSync(flattenedSourcePath));
    assert.ok(existsSync(receiptPath));

    const receipt = readJson(receiptPath);
    assert.equal(receipt.request.metadata.operation, "export_psd");
    assert.equal(receipt.request.metadata.export_contract, JUGGERNAUT_PSD_EXPORT_CONTRACT);
    assert.equal(receipt.result_metadata.source_image_count, step.expected.sourceImageCount);
    assert.equal(receipt.result_metadata.timeline_node_count, request.timelineNodes.length);
    results.exports.push({
      request,
      outPath,
      receiptPath,
    });
    return receipt;
  }

  function persistFailureArtifacts(error) {
    const payload = {
      flowId: flow.id,
      error: {
        message: String(error?.message || error),
        stack: String(error?.stack || ""),
      },
      results,
      activeImage: cloneJson(getActiveImage()),
      marks: cloneJson(marks),
      regionCandidates: cloneJson(regionCandidates),
      timelineNodes: cloneJson(timelineNodes),
      traces: readJsonl(tracePath()),
    };
    writeJson(join(runDir, "failure-artifacts.json"), payload);
    if (error && typeof error === "object") {
      error.message = `${error.message} [failure artifacts: ${runDir}]`;
    }
  }

  return {
    async run() {
      for (const step of flow.steps) {
        if (step.kind === "observable_trace_entry") {
          await runObservableStep(step);
          continue;
        }
        if (step.kind === "focus_contract") {
          await runFocusContractStep(step);
          continue;
        }
        if (step.kind === "design_review_accept") {
          await runDesignReviewAcceptStep(step);
          continue;
        }
        if (step.kind === "direct_affordance") {
          await runDirectAffordanceStep(step);
          continue;
        }
        if (step.kind === "export_psd") {
          await runExportStep(step);
          continue;
        }
        throw new Error(`Unsupported fixture step: ${step.kind}`);
      }
    },
    fail(error) {
      failed = true;
      persistFailureArtifacts(error);
    },
    cleanup() {
      if (!failed) {
        rmSync(runDir, { recursive: true, force: true });
      }
    },
  };
}

for (const flow of replayFixtures.flows) {
  test(`replay flow: ${flow.id}`, async () => {
    const harness = createHarness(flow);
    try {
      await harness.run();
    } catch (error) {
      harness.fail(error);
      throw error;
    } finally {
      harness.cleanup();
    }
  });
}
