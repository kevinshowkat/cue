import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SINGLE_IMAGE_DIRECT_AFFORDANCE_MAP,
  SINGLE_IMAGE_EXECUTION_TYPES,
  SINGLE_IMAGE_CAPABILITY_MAP,
  SINGLE_IMAGE_RAIL_CONTRACT,
  buildSingleImageCapabilityDisabledMessage,
  buildSingleImageCapabilityReceiptStep,
  buildSingleImageRailJobEntries,
  listSingleImageDirectAffordances,
  normalizeSingleImageCapabilityRequest,
  resolveSingleImageAffordanceRoute,
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

test("single-image direct affordance map adds remove people, polish, and relight with explicit routing strategy", () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(SINGLE_IMAGE_DIRECT_AFFORDANCE_MAP).map(([jobId, spec]) => [
        jobId,
        {
          capability: spec.capability,
          executionType: spec.executionType,
          routeProfile: spec.routeProfile,
          localOperation: spec.localOperation,
          provenance: spec.provenance,
        },
      ])
    ),
    {
      remove_people: {
        capability: "people_removal",
        executionType: SINGLE_IMAGE_EXECUTION_TYPES.MODEL_BACKED,
        routeProfile: "remove_people_model",
        localOperation: null,
        provenance: "external_model",
      },
      polish: {
        capability: "image_polish",
        executionType: SINGLE_IMAGE_EXECUTION_TYPES.LOCAL_FIRST,
        routeProfile: "polish_local_first",
        localOperation: "polish",
        provenance: "local_first",
      },
      relight: {
        capability: "image_relight",
        executionType: SINGLE_IMAGE_EXECUTION_TYPES.LOCAL_FIRST,
        routeProfile: "relight_local_first",
        localOperation: "relight",
        provenance: "local_first",
      },
    }
  );
  assert.equal(listSingleImageDirectAffordances().length, 3);
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
      subjectSelectionAvailable: true,
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
    provenance: "external_model",
  });
  assert.equal(jobs[1].disabledReason, "capability_unavailable");
  assert.equal(jobs[2].disabledReason, "unavailable_in_current_mode");
  assert.equal(jobs[3].disabledReason, "unsupported_image");
  assert.equal(jobs[4].enabled, true);
});

test("single-image capability availability blocks selectionless and local-only requests without provider leakage", () => {
  const cutOutBlocked = resolveSingleImageCapabilityAvailability("cut_out", {
    activeImageId: "img-1",
    selectedImageIds: ["img-1"],
    subjectSelectionAvailable: false,
    capabilityAvailability: {
      subject_isolation: { available: true },
    },
  });
  assert.equal(cutOutBlocked.disabledReason, "selection_required");
  assert.equal(
    buildSingleImageCapabilityDisabledMessage("cut_out", cutOutBlocked),
    "Cut Out needs a lasso or Magic Select region first."
  );

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
    provenance: "external_model",
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
    surface: "rail",
    executionType: "model_backed",
    routeProfile: "model_capability_only",
    executionKind: "model_capability",
    localOperation: null,
    fallbackExecutionKind: null,
    provenance: "external_model",
    contract: SINGLE_IMAGE_RAIL_CONTRACT,
    params: {},
    confidence: 0.61,
    reasonCodes: ["object_mask_present"],
  });
});

test("single-image direct affordance routing keeps polish local-first and escalates relight to model when directionality is requested", () => {
  const polish = resolveSingleImageAffordanceRoute({
    jobId: "polish",
    params: {
      intensity: 0.72,
    },
  });
  assert.deepEqual(
    {
      jobId: polish.jobId,
      executionType: polish.executionType,
      executionKind: polish.executionKind,
      routeProfile: polish.routeProfile,
      localOperation: polish.localOperation,
      provenance: polish.provenance,
    },
    {
      jobId: "polish",
      executionType: "local_first",
      executionKind: "local_edit",
      routeProfile: "polish_local_first",
      localOperation: "polish",
      provenance: "local_first",
    }
  );

  const relight = resolveSingleImageAffordanceRoute({
    jobId: "relight",
    params: {
      lightDirection: "left",
    },
  });
  assert.equal(relight.executionKind, "model_capability");

  const relightModeBlocked = resolveSingleImageCapabilityAvailability(
    {
      jobId: "relight",
      params: {
        lightDirection: "left",
      },
    },
    {
      activeImageId: "img-5",
      selectedImageIds: ["img-5"],
      mode: "local_only",
    }
  );
  assert.equal(relightModeBlocked.disabledReason, "unavailable_in_current_mode");

  const availability = resolveSingleImageCapabilityAvailability(
    {
      jobId: "polish",
      params: {
        intensity: 0.5,
      },
    },
    {
      activeImageId: "img-4",
      selectedImageIds: ["img-4"],
      mode: "local_only",
    }
  );
  assert.equal(availability.enabled, true);
  assert.equal(availability.executionKind, "local_edit");
  assert.equal(availability.provenance, "local_first");
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

test("single-image direct affordance receipt carries route metadata for model-backed actions", () => {
  const receiptStep = buildSingleImageCapabilityReceiptStep("remove_people", {
    outputPath: "/tmp/remove-people.png",
    receiptPath: "/tmp/remove-people-receipt.json",
  });
  assert.deepEqual(receiptStep, {
    kind: "model_capability_edit",
    source: "tool_runtime",
    jobId: "remove_people",
    toolId: "remove_people",
    toolName: "Remove People",
    capability: "people_removal",
    outputPath: "/tmp/remove-people.png",
    receiptPath: "/tmp/remove-people-receipt.json",
    executionType: "model_backed",
    routeProfile: "remove_people_model",
  });
});
