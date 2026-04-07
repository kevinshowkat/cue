import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createNativeMenuRuntime } from "../src/app/native_menu_runtime.js";

const bridgeSource = readFileSync(
  new URL("../src-tauri/src/main.rs", import.meta.url),
  "utf8"
);

function createToggle() {
  return { disabled: false };
}

test("native system menu defines file, tools, and shortcuts menus", () => {
  assert.match(bridgeSource, /Submenu::new\("File", build_file_menu\(\)\)/);
  assert.match(bridgeSource, /Submenu::new\("Tools", build_tools_menu\(\)\)/);
  assert.match(bridgeSource, /Submenu::new\("Shortcuts", build_shortcuts_menu\(\)\)/);
  assert.match(bridgeSource, /MENU_FILE_SAVE_SESSION/);
  assert.match(bridgeSource, /MENU_TOOLS_SLOT_PREFIX/);
  assert.match(bridgeSource, /MENU_SHORTCUTS_SLOT_PREFIX/);
});

test("native system menu exposes a sync command for dynamic slot state", () => {
  assert.match(bridgeSource, /fn sync_native_menu_state\(/);
  assert.match(bridgeSource, /sync_native_menu_slots\(/);
  assert.match(bridgeSource, /sync_native_menu_state,/);
});

test("native tools menu mirrors the Bridge baseline and excludes Make Space before custom tools", async () => {
  assert.match(
    bridgeSource,
    /let slot_labels = \[[\s\S]*"Marker",[\s\S]*"Highlight",[\s\S]*"Magic Select",[\s\S]*"Stamp",[\s\S]*"Eraser",[\s\S]*"Custom Tool Slot 1",[\s\S]*"Custom Tool Slot 2",[\s\S]*"Custom Tool Slot 3",[\s\S]*\];/
  );
  assert.doesNotMatch(bridgeSource, /let slot_labels = \[[\s\S]*"Make Space"[\s\S]*\];/);

  const invocations = [];
  const communicationSelections = [];
  const runtime = createNativeMenuRuntime({
    els: {
      newRun: createToggle(),
      openRun: createToggle(),
      saveSession: createToggle(),
      closeSession: createToggle(),
      import: createToggle(),
      export: createToggle(),
      settingsToggle: createToggle(),
    },
    state: {
      activeTabId: "tab-1",
    },
    tabbedSessions: {
      tabsOrder: ["tab-1", "tab-2"],
    },
    getSessionToolRegistry: () => ({
      visible: () => [
        { toolId: "polish-pass", label: "Polish Pass" },
        { toolId: "mono-pass", shortLabel: "Mono" },
      ],
    }),
    currentTabSwitchBlockReason: () => null,
    getVisibleCanvasImages: () => [{ id: "img-1" }],
    nativeMenuCommunicationTools: [
      { toolId: "marker", label: "Marker" },
      { toolId: "protect", label: "Highlight" },
      { toolId: "magic_select", label: "Magic Select" },
      { toolId: "stamp", label: "Stamp" },
      { toolId: "eraser", label: "Eraser" },
    ],
    setCommunicationTool: (toolId, meta = {}) => {
      communicationSelections.push({ toolId, meta });
      return { ok: true, toolId, meta };
    },
    invokeRegisteredTool: (toolId, meta = {}) => {
      invocations.push({ toolId, meta });
      return { ok: true, toolId, meta };
    },
  });

  const slots = runtime.buildNativeToolSlots();
  assert.deepEqual(slots.slice(0, 8), [
    { label: "Marker", enabled: true },
    { label: "Highlight", enabled: true },
    { label: "Magic Select", enabled: true },
    { label: "Stamp", enabled: true },
    { label: "Eraser", enabled: true },
    { label: "Polish Pass", enabled: true },
    { label: "Mono", enabled: true },
    { label: "Custom Tool Slot 3", enabled: false },
  ]);

  await runtime.runNativeToolSlot(0);
  await runtime.runNativeToolSlot(5);

  assert.deepEqual(communicationSelections, [
    {
      toolId: "marker",
      meta: { source: "native_menu" },
    },
  ]);
  assert.deepEqual(invocations, [
    {
      toolId: "polish-pass",
      meta: { source: "native_menu", trigger: "menu" },
    },
  ]);
});
