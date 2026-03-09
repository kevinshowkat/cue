import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SINGLE_IMAGE_CAPABILITY_MAP,
  SINGLE_IMAGE_RAIL_CONTRACT,
  buildSingleImageCapabilityDisabledMessage,
  buildSingleImageCapabilityReceiptStep,
  buildSingleImageRailJobEntries,
  normalizeSingleImageCapabilityRequest,
  resolveSingleImageCapabilityAvailability,
} from "../src/single_image_capability_routing.js";

test("single-image capability map seeds the approved five jobs", () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(SINGLE_IMAGE_CAPABILITY_MAP).map(([jobId, spec]) => [jobId, spec.capability])
    ),
    {
      cut_out: "subject_isolation",
      remove: "targeted_remove",
      new_background: "background_replace",
      reframe: "crop_or_outpaint",
      variants: "identity_preserving_variation",
    }
  );
});

test("single-image rail job entries use generic availability reasons and stable output shape", () => {
  const jobs = buildSingleImageRailJobEntries(
    [
      { jobId: "cut_out", confidence: 0.92, reasonCodes: ["foreground_detected"] },
      { jobId: "variants", confidence: 0.74, reasonCodes: ["identity_locked"] },
    ],
    {
      activeImageId: "img-1",
      selectedImageIds: ["img-1"],
      busy: false,
      capabilityAvailability: {
        subject_isolation: { available: true },
        targeted_remove: { available: false, disabledReason: "capability_unavailable" },
        background_replace: { available: false, disabledReason: "unavailable_in_current_mode" },
        crop_or_outpaint: { available: false, disabledReason: "unsupported_image" },
        identity_preserving_variation: { available: true },
      },
    }
  );

  assert.equal(jobs.length, 5);
  assert.deepEqual(jobs[0], {
    jobId: "cut_out",
    label: "Cut Out",
    capability: "subject_isolation",
    requiresSelection: true,
    enabled: true,
    disabledReason: null,
    confidence: 0.92,
    reasonCodes: ["foreground_detected"],
    stickyKey: "single-image-rail:cut_out",
  });
  assert.equal(jobs[1].disabledReason, "capability_unavailable");
  assert.equal(jobs[2].disabledReason, "unavailable_in_current_mode");
  assert.equal(jobs[3].disabledReason, "unsupported_image");
  assert.equal(jobs[4].enabled, true);
});

test("single-image capability availability blocks selectionless and local-only requests without provider leakage", () => {
  const selectionBlocked = resolveSingleImageCapabilityAvailability("new_background", {
    activeImageId: "",
    selectedImageIds: [],
    capabilityAvailability: {
      background_replace: { available: true },
    },
  });
  assert.deepEqual(selectionBlocked, {
    jobId: "new_background",
    label: "New Background",
    capability: "background_replace",
    requiresSelection: true,
    enabled: false,
    disabledReason: "selection_required",
    reasonCodes: ["selection_required"],
    stickyKey: "single-image-rail:new_background",
  });

  const modeBlocked = resolveSingleImageCapabilityAvailability("variants", {
    activeImageId: "img-1",
    selectedImageIds: ["img-1"],
    mode: "local_only",
    capabilityExecutorAvailable: true,
  });
  assert.equal(modeBlocked.disabledReason, "unavailable_in_current_mode");
  assert.doesNotMatch(JSON.stringify(modeBlocked), /openai|gemini|flux|imagen/i);
});

test("single-image capability request normalization accepts the approved rail contract and legacy shell aliases", () => {
  const normalized = normalizeSingleImageCapabilityRequest({
    contract: SINGLE_IMAGE_RAIL_CONTRACT,
    toolId: "cleanup",
    selectedImageId: "img-1",
    execution: {
      kind: "model_capability",
      capability: "targeted_remove",
    },
    rail: {
      confidence: 0.61,
      reasonCodes: ["object_mask_present"],
    },
  });

  assert.deepEqual(normalized, {
    jobId: "remove",
    label: "Remove",
    capability: "targeted_remove",
    requiresSelection: true,
    stickyKey: "single-image-rail:remove",
    executionKind: "model_capability",
    contract: SINGLE_IMAGE_RAIL_CONTRACT,
    params: {},
    confidence: 0.61,
    reasonCodes: ["object_mask_present"],
  });
});

test("single-image capability receipt and disabled message stay generic", () => {
  const receiptStep = buildSingleImageCapabilityReceiptStep("cut_out", {
    outputPath: "/tmp/cutout.png",
    receiptPath: "/tmp/cutout-receipt.json",
  });
  assert.deepEqual(receiptStep, {
    kind: "model_capability_edit",
    source: "tool_runtime",
    jobId: "cut_out",
    toolId: "cut_out",
    toolName: "Cut Out",
    capability: "subject_isolation",
    outputPath: "/tmp/cutout.png",
    receiptPath: "/tmp/cutout-receipt.json",
  });

  const message = buildSingleImageCapabilityDisabledMessage("variants", {
    disabledReason: "busy",
  });
  assert.equal(message, "Variants is unavailable while another image action is running.");
  assert.doesNotMatch(message, /openai|gemini|flux|imagen/i);
});
