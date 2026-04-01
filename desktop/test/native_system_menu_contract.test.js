import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const bridgeSource = readFileSync(
  new URL("../src-tauri/src/main.rs", import.meta.url),
  "utf8"
);
const appSource = readFileSync(
  new URL("../src/canvas_app.js", import.meta.url),
  "utf8"
);

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

test("native tools menu mirrors the Bridge baseline and excludes Make Space before custom tools", () => {
  assert.match(
    bridgeSource,
    /let slot_labels = \[[\s\S]*"Marker",[\s\S]*"Highlight",[\s\S]*"Magic Select",[\s\S]*"Stamp",[\s\S]*"Eraser",[\s\S]*"Custom Tool Slot 1",[\s\S]*"Custom Tool Slot 2",[\s\S]*"Custom Tool Slot 3",[\s\S]*\];/
  );
  assert.doesNotMatch(bridgeSource, /let slot_labels = \[[\s\S]*"Make Space"[\s\S]*\];/);
  assert.match(
    bridgeSource,
    /let slot_labels = \[[\s\S]*"Marker",[\s\S]*"Highlight",[\s\S]*"Magic Select",[\s\S]*"Stamp",[\s\S]*"Eraser",[\s\S]*"Custom Tool Slot 1",[\s\S]*"Custom Tool Slot 2",[\s\S]*"Custom Tool Slot 3",[\s\S]*\];/
  );
  assert.doesNotMatch(bridgeSource, /let slot_labels = \[[\s\S]*"Make Space"[\s\S]*\];/);
  assert.match(
    appSource,
    /const NATIVE_MENU_COMMUNICATION_TOOLS = Object\.freeze\(\[[\s\S]*Marker[\s\S]*Highlight[\s\S]*Magic Select[\s\S]*Stamp[\s\S]*Eraser[\s\S]*\]\);/
  );
  assert.doesNotMatch(appSource, /const NATIVE_MENU_COMMUNICATION_TOOLS = Object\.freeze\(\[[\s\S]*Make Space[\s\S]*\]\);/);
  assert.match(
    appSource,
    /function buildNativeToolSlots\(\) \{[\s\S]*NATIVE_MENU_COMMUNICATION_TOOLS[\s\S]*visibleCustomTools = sessionToolRegistry\.visible\(\{ limit: customToolLimit \}\)[\s\S]*kind: "communication_tool"/
  );
  assert.match(
    appSource,
    /function buildNativeToolSlots\(\) \{[\s\S]*visibleCustomTools = sessionToolRegistry\.visible\(\{ limit: customToolLimit \}\)[\s\S]*kind: "custom_tool"/
  );
  assert.match(
    appSource,
    /async function runNativeToolSlot\(index = -1\) \{[\s\S]*slot\.kind === "communication_tool"[\s\S]*setCommunicationTool\(toolId, \{ source: "native_menu" \}\)[\s\S]*invokeRegisteredTool\(toolId, \{/
  );
});
