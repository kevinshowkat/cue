import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SINGLE_IMAGE_RAIL_CONTRACT,
  TOOL_INVOCATION_EVENT,
  TOOL_INVOCATION_SCHEMA,
  TOOL_MANIFEST_SCHEMA,
  TOOL_RUNTIME_BRIDGE_KEY,
  buildSingleImageDirectAffordanceInvocation,
  buildSingleImageRailInvocation,
  buildSingleImageRailJobEntries,
  buildToolInvocation,
  createInSessionToolRegistry,
  generateToolManifest,
} from "../src/tool_runtime.js";

const here = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(here, "..", "src", "index.html");
const appPath = join(here, "..", "src", "canvas_app.js");
const html = readFileSync(htmlPath, "utf8");
const app = readFileSync(appPath, "utf8");

test("generateToolManifest maps descriptive input into a deterministic local tool schema", () => {
  const manifest = generateToolManifest({
    name: "Noir Wash",
    description: "make this black and white with a punchier look",
  });

  assert.equal(manifest.schema, TOOL_MANIFEST_SCHEMA);
  assert.equal(manifest.label, "Noir Wash");
  assert.equal(manifest.execution.kind, "local_edit");
  assert.equal(manifest.execution.operation, "grayscale");
  assert.equal(manifest.inputContract.minImages, 1);
  assert.equal(manifest.inputContract.maxImages, 1);
  assert.equal(manifest.receipt.reproducible, true);
});

test("in-session tool registry keeps unique ids and newest tools visible first", () => {
  const registry = createInSessionToolRegistry();
  const first = registry.createFromDescription({
    name: "Mirror",
    description: "mirror the image left to right",
  });
  const second = registry.createFromDescription({
    name: "Mirror",
    description: "mirror the image left to right",
  });

  assert.equal(registry.size(), 2);
  assert.equal(first.toolId, "mirror");
  assert.equal(second.toolId, "mirror-2");
  assert.deepEqual(
    registry.visible({ limit: 2 }).map((tool) => tool.toolId),
    ["mirror-2", "mirror"]
  );
});

test("buildToolInvocation emits the edit-branch contract with selection and execution payload", () => {
  const manifest = generateToolManifest({
    name: "Soft Focus",
    description: "add a dreamy blur",
  });
  const invocation = buildToolInvocation(manifest, {
    activeImageId: "img-1",
    selectedImageIds: ["img-1"],
    source: "bridge",
    trigger: "api",
    requestId: "tool-runtime-7",
  });

  assert.equal(invocation.schema, TOOL_INVOCATION_SCHEMA);
  assert.equal(invocation.requestId, "tool-runtime-7");
  assert.equal(invocation.tool.toolId, manifest.toolId);
  assert.equal(invocation.execution.operation, "blur");
  assert.equal(invocation.target.activeImageId, "img-1");
  assert.deepEqual(invocation.target.selectedImageIds, ["img-1"]);
  assert.equal(invocation.receipt.manifestSchema, manifest.schema);
});

test("Create Tool UI and browser bridge are wired into the desktop app", () => {
  assert.match(html, /id="custom-tool-dock"/);
  assert.match(html, /id="create-tool-panel"/);
  assert.match(html, /id="create-tool-name"/);
  assert.match(html, /id="create-tool-text"/);
  assert.match(html, /id="create-tool-preview"/);
  assert.match(html, /id="create-tool-save"/);

  assert.match(app, /function renderCustomToolDock\(/);
  assert.match(app, /function runCreateToolFromPanel\(/);
  assert.match(app, /function invokeRegisteredTool\(/);
  assert.match(app, /window\[TOOL_RUNTIME_BRIDGE_KEY\]/);
  assert.match(app, /TOOL_INVOCATION_EVENT/);
  assert.match(app, /sessionToolRegistry\.createFromDescription/);
  assert.match(app, /customToolDock:\s*document\.getElementById\("custom-tool-dock"\)/);
  assert.match(app, /tool-runtime-\$\{state\.toolInvocationSeq\+\+\}/);
});

test("tool runtime exports a stable bridge key and invocation event name", () => {
  assert.equal(TOOL_RUNTIME_BRIDGE_KEY, "__JUGGERNAUT_TOOL_RUNTIME__");
  assert.equal(TOOL_INVOCATION_EVENT, "juggernaut:tool-invoked");
});

test("single-image rail invocation uses the approved capability contract without exposing providers", () => {
  const jobs = buildSingleImageRailJobEntries(
    [{ jobId: "cut_out", confidence: 0.83, reasonCodes: ["subject_present"] }],
    {
      activeImageId: "img-1",
      selectedImageIds: ["img-1"],
      capabilityAvailability: {
        subject_isolation: { available: true },
      },
    }
  );

  const invocation = buildSingleImageRailInvocation("cut_out", {
    activeImageId: "img-1",
    selectedImageIds: ["img-1"],
    requestId: "single-image-7",
    confidence: jobs[0].confidence,
    reasonCodes: jobs[0].reasonCodes,
    capabilityAvailability: {
      subject_isolation: { available: true },
    },
  });

  assert.equal(invocation.contract, SINGLE_IMAGE_RAIL_CONTRACT);
  assert.equal(invocation.jobId, "cut_out");
  assert.equal(invocation.capability, "subject_isolation");
  assert.equal(invocation.execution.kind, "model_capability");
  assert.equal(invocation.tool.toolId, "cut_out");
  assert.equal(invocation.rail.stickyKey, "single-image-rail:cut_out");
  assert.equal(invocation.availability.enabled, true);
  assert.doesNotMatch(JSON.stringify(invocation), /openai|gemini|flux|imagen/i);
});

test("single-image direct affordance invocation resolves local-first and model-backed routes without rail wiring", () => {
  const polish = buildSingleImageDirectAffordanceInvocation("polish", {
    activeImageId: "img-8",
    selectedImageIds: ["img-8"],
    requestId: "direct-8",
    mode: "single",
    params: {
      intensity: 0.62,
    },
  });

  assert.equal(polish.contract, SINGLE_IMAGE_RAIL_CONTRACT);
  assert.equal(polish.jobId, "polish");
  assert.equal(polish.execution.kind, "local_edit");
  assert.equal(polish.execution.operation, "polish");
  assert.equal(polish.execution.executionType, "local_first");
  assert.equal(polish.route.profile, "polish_local_first");
  assert.equal(polish.availability.enabled, true);

  const relight = buildSingleImageDirectAffordanceInvocation("relight", {
    activeImageId: "img-9",
    selectedImageIds: ["img-9"],
    requestId: "direct-9",
    params: {
      lightDirection: "left",
    },
    capabilityAvailability: {
      image_relight: { available: true },
    },
    capabilityExecutorAvailable: true,
  });

  assert.equal(relight.execution.kind, "model_capability");
  assert.equal(relight.route.executionKind, "model_capability");
  assert.equal(relight.execution.routeProfile, "relight_local_first");
  assert.equal(relight.capability, "image_relight");
});
