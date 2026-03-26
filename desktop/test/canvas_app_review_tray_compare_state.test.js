import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const app = readFileSync(appPath, "utf8");

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

function instantiateFunction(name, deps = {}) {
  const source = extractFunctionSource(name);
  const keys = Object.keys(deps);
  const values = Object.values(deps);
  return new Function(...keys, `return (${source});`)(...values);
}

test("communication tray snapshot preserves selected proposal compare ui state", () => {
  const readFirstString = instantiateFunction("readFirstString");
  const normalizeCommunicationProposalTrayUiState = instantiateFunction(
    "normalizeCommunicationProposalTrayUiState",
    {
      readFirstString,
    }
  );
  const normalizeCommunicationProposalSlotStatus = instantiateFunction(
    "normalizeCommunicationProposalSlotStatus"
  );
  const communicationProposalDefaultLabel = instantiateFunction(
    "communicationProposalDefaultLabel",
    {
      normalizeCommunicationProposalSlotStatus,
    }
  );
  const communicationProposalDefaultTitle = instantiateFunction(
    "communicationProposalDefaultTitle",
    {
      normalizeCommunicationProposalSlotStatus,
    }
  );
  const communicationProposalDefaultCopy = instantiateFunction(
    "communicationProposalDefaultCopy",
    {
      normalizeCommunicationProposalSlotStatus,
    }
  );
  const createCommunicationProposalSlot = instantiateFunction(
    "createCommunicationProposalSlot",
    {
      COMMUNICATION_PROPOSAL_SLOT_COUNT: 3,
      normalizeCommunicationProposalSlotStatus,
      communicationProposalDefaultLabel,
      communicationProposalDefaultTitle,
      communicationProposalDefaultCopy,
      readFirstString,
    }
  );
  const createFreshCommunicationState = instantiateFunction("createFreshCommunicationState", {
    COMMUNICATION_PROPOSAL_SLOT_COUNT: 3,
    createCommunicationProposalSlot,
    normalizeCommunicationProposalTrayUiState,
    Map,
  });

  const state = {
    communication: createFreshCommunicationState(),
  };
  state.communication.proposalTray.visible = true;
  state.communication.proposalTray.requestId = "review-compare-1";
  state.communication.proposalTray.source = "review_runtime";
  state.communication.proposalTray.ui = {
    selectedProposalId: "proposal-2",
    compareMode: "original",
    showSafeAreas: true,
  };
  state.communication.proposalTray.slots = [
    createCommunicationProposalSlot(0, {
      proposalId: "proposal-1",
      status: "ready",
      previewImagePath: "/tmp/proposal-a.png",
      changedRegionBounds: { x: 32, y: 28, width: 420, height: 260 },
      preserveRegionIds: ["safe-1"],
      rationaleCodes: ["subject_centered"],
    }),
    createCommunicationProposalSlot(1, {
      proposalId: "proposal-2",
      status: "ready",
      previewImagePath: "/tmp/proposal-b.png",
      changedRegionBounds: { x: 84, y: 64, width: 360, height: 240 },
      preserveRegionIds: ["safe-1", "protect-hero"],
      rationaleCodes: ["copy_lane_available", "background_separable"],
    }),
    createCommunicationProposalSlot(2, {
      status: "hidden",
    }),
  ];

  const buildCommunicationProposalTraySnapshot = instantiateFunction(
    "buildCommunicationProposalTraySnapshot",
    {
      state,
      createFreshCommunicationState,
      createCommunicationProposalSlot,
      COMMUNICATION_PROPOSAL_SLOT_COUNT: 3,
      normalizeCommunicationProposalTrayUiState,
      readFirstString,
    }
  );

  const snapshot = buildCommunicationProposalTraySnapshot();

  assert.equal(snapshot.ui.selectedProposalId, "proposal-2");
  assert.equal(snapshot.ui.compareMode, "original");
  assert.equal(snapshot.ui.showSafeAreas, true);
  assert.equal(snapshot.slots[0].selected, false);
  assert.equal(snapshot.slots[1].selected, true);
  assert.equal(snapshot.slots[1].previewImagePath, "/tmp/proposal-b.png");
  assert.deepEqual(snapshot.slots[1].preserveRegionIds, ["safe-1", "protect-hero"]);
  assert.deepEqual(snapshot.slots[1].rationaleCodes, ["copy_lane_available", "background_separable"]);
  assert.equal("previewPath" in snapshot.slots[1], false);
});

test("communication tray review-state mapping carries full-frame preview metadata for compare surfaces", () => {
  const readFirstString = instantiateFunction("readFirstString");
  const normalizeCommunicationProposalTrayUiState = instantiateFunction(
    "normalizeCommunicationProposalTrayUiState",
    {
      readFirstString,
    }
  );
  const normalizeCommunicationProposalSlotStatus = instantiateFunction(
    "normalizeCommunicationProposalSlotStatus"
  );
  const communicationProposalDefaultLabel = instantiateFunction(
    "communicationProposalDefaultLabel",
    {
      normalizeCommunicationProposalSlotStatus,
    }
  );
  const communicationProposalDefaultTitle = instantiateFunction(
    "communicationProposalDefaultTitle",
    {
      normalizeCommunicationProposalSlotStatus,
    }
  );
  const communicationProposalDefaultCopy = instantiateFunction(
    "communicationProposalDefaultCopy",
    {
      normalizeCommunicationProposalSlotStatus,
    }
  );
  const createCommunicationProposalSlot = instantiateFunction(
    "createCommunicationProposalSlot",
    {
      COMMUNICATION_PROPOSAL_SLOT_COUNT: 3,
      normalizeCommunicationProposalSlotStatus,
      communicationProposalDefaultLabel,
      communicationProposalDefaultTitle,
      communicationProposalDefaultCopy,
      readFirstString,
    }
  );
  const clampText = instantiateFunction("clampText");
  const communicationProposalCopyFromReviewState = instantiateFunction(
    "communicationProposalCopyFromReviewState",
    {
      clampText,
      readFirstString,
      communicationProposalDefaultCopy,
    }
  );
  const state = {
    communication: {
      proposalTray: {
        ui: {
          selectedProposalId: "proposal-b",
          compareMode: "proposal",
          showSafeAreas: false,
        },
      },
    },
  };

  const buildCommunicationProposalSlotsFromReviewState = instantiateFunction(
    "buildCommunicationProposalSlotsFromReviewState",
    {
      state,
      COMMUNICATION_PROPOSAL_SLOT_COUNT: 3,
      normalizeCommunicationProposalSlotStatus,
      communicationProposalCopyFromReviewState,
      communicationProposalDefaultTitle,
      buildCommunicationReviewPendingSlots: () => {
        throw new Error("pending slots should not be used in this test");
      },
      createCommunicationProposalSlot,
      normalizeCommunicationProposalTrayUiState,
      readFirstString,
    }
  );

  const slots = buildCommunicationProposalSlotsFromReviewState({
    status: "ready",
    request: {
      primaryImageId: "img-hero",
      visibleCanvasContext: {
        images: [
          {
            id: "img-hero",
            path: "/tmp/original-frame.png",
            width: 1680,
            height: 1050,
            label: "Hero",
          },
        ],
      },
    },
    slots: [
      {
        rank: 1,
        status: "ready",
        proposal: {
          proposalId: "proposal-a",
          label: "Tone down background noise",
          changedRegionBounds: { x: 24, y: 36, width: 520, height: 280 },
          preserveRegionIds: ["safe-1"],
          rationaleCodes: ["background_noise"],
        },
      },
      {
        rank: 2,
        status: "ready",
        proposal: {
          proposalId: "proposal-b",
          label: "Open safe copy lane",
          previewImagePath: "/tmp/proposal-preview.png",
          changedRegionBounds: { x: 180, y: 40, width: 480, height: 320 },
          preserveRegionIds: ["safe-1", "protect-hero"],
          rationaleCodes: ["copy_lane_available", "subject_isolated"],
        },
      },
    ],
  });

  assert.equal(slots[0].previewImagePath, null);
  assert.deepEqual(slots[0].changedRegionBounds, { x: 24, y: 36, width: 520, height: 280 });
  assert.deepEqual(slots[0].preserveRegionIds, ["safe-1"]);
  assert.deepEqual(slots[0].rationaleCodes, ["background_noise"]);
  assert.equal(slots[1].previewImagePath, "/tmp/proposal-preview.png");
  assert.deepEqual(slots[1].changedRegionBounds, { x: 180, y: 40, width: 480, height: 320 });
  assert.deepEqual(slots[1].preserveRegionIds, ["safe-1", "protect-hero"]);
  assert.deepEqual(slots[1].rationaleCodes, ["copy_lane_available", "subject_isolated"]);
  assert.equal(slots[1].selected, true);
  assert.equal("previewPath" in slots[1], false);
  assert.equal("sourcePath" in slots[1], false);
});
