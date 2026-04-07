import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CANVAS_APP_REQUIRED_BOOT_FIELDS,
  createCanvasAppDom,
  validateCanvasAppBootDom,
} from "../src/app/dom.js";

function createDocumentMock({ ids = [], selectors = {} } = {}) {
  const idMap = new Map(ids.map((id) => [id, { id }]));
  return {
    getElementById(id) {
      return idMap.get(id) || null;
    },
    querySelector(selector) {
      return selectors[selector] || null;
    },
  };
}

test("app dom: resolves the shared DOM registry from one module", () => {
  const documentObj = createDocumentMock({
    ids: ["app", "boot-error", "agent-runner-expand", "agent-runner-submit", "timeline-dock"],
    selectors: {
      ".brand-strip": { className: "brand-strip" },
    },
  });

  const dom = createCanvasAppDom(documentObj);

  assert.equal(dom.appRoot?.id, "app");
  assert.equal(dom.bootError?.id, "boot-error");
  assert.equal(dom.brandStrip?.className, "brand-strip");
  assert.equal(dom.agentRunnerExpand?.id, "agent-runner-expand");
  assert.equal(dom.agentRunnerSubmit?.id, "agent-runner-submit");
  assert.equal(dom.timelineDock?.id, "timeline-dock");
  assert.equal(dom.runtimePinAssistantToggle, null);
  assert.equal(dom.runtimeDiagnosticsToggle, null);
});

test("app dom: boot validation lists missing required nodes", () => {
  assert.throws(
    () => validateCanvasAppBootDom({}),
    /Cue canvas boot missing required DOM nodes: appRoot, brandStrip, sessionTabList/
  );

  const dom = Object.fromEntries(CANVAS_APP_REQUIRED_BOOT_FIELDS.map((key) => [key, { key }]));
  assert.equal(validateCanvasAppBootDom(dom), dom);
});
