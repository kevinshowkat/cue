import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNativeSystemMenuPayload,
  NATIVE_SHORTCUT_SLOT_COUNT,
  NATIVE_TOOLS_SLOT_COUNT,
} from "../src/system_menu_state.js";

test("native system menu payload fills fixed tool and shortcut slots", () => {
  const payload = buildNativeSystemMenuPayload({
    file: {
      canNewSession: true,
      canOpenSession: true,
      canSaveSession: true,
      canCloseSession: false,
      canExportSession: true,
    },
    tools: [
      { label: "Marker", enabled: true },
      { label: "Highlight", enabled: true },
      { label: "Magic Select", enabled: true },
      { label: "Eraser", enabled: true },
    ],
    shortcuts: [
      { label: "Move", enabled: true },
      { label: "Upload", enabled: true },
    ],
  });

  assert.equal(payload.file.canSaveSession, true);
  assert.equal(payload.file.canCloseSession, false);
  assert.equal(payload.tools.length, NATIVE_TOOLS_SLOT_COUNT);
  assert.deepEqual(payload.tools[0], { label: "Marker", enabled: true });
  assert.deepEqual(payload.tools[1], { label: "Highlight", enabled: true });
  assert.deepEqual(payload.tools[2], { label: "Magic Select", enabled: true });
  assert.deepEqual(payload.tools[3], { label: "Eraser", enabled: true });
  assert.deepEqual(payload.tools[4], { label: "Tool Slot 5", enabled: false });
  assert.equal(payload.shortcuts.length, NATIVE_SHORTCUT_SLOT_COUNT);
  assert.deepEqual(payload.shortcuts[0], { label: "Move", enabled: true });
  assert.deepEqual(payload.shortcuts[1], { label: "Upload", enabled: true });
  assert.deepEqual(payload.shortcuts[2], { label: "Shortcut Slot 3", enabled: false });
});
